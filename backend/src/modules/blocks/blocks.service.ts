// A restaurant's blocks: times when one table, or the whole restaurant, can't be booked, such as a
// broken table, a private event or a holiday. A block is refused if bookings fall inside it.
// Blocks aren't bookings, so removing one really deletes it.
//
// Lock order, the same in every change (see tables.service.ts): table rows first, in ascending id
// order, then the restaurant's row.
import { Prisma } from "../../generated/prisma/client.ts";
import type { TableZone } from "../../generated/prisma/enums.ts";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors.ts";
import { prisma } from "../../lib/prisma.ts";
import { localClockTime, localDate } from "../../lib/time.ts";
import { ownerReservationFields, toOwnerReservation } from "../reservations/owner.service.ts";
import { ACTIVE_STATUSES } from "../reservations/reservations.rules.ts";
import { lockOwnedTable } from "../tables/tables.service.ts";
import { blockRange, blockRangeProblem, blockRefusalMessage } from "./blocks.rules.ts";
import type { BlockTime } from "./blocks.rules.ts";
import type { BlockListQuery, CreateBlockInput } from "./blocks.schemas.ts";

/** A block as its owner sees it in the dashboard. */
export interface OwnerBlock {
  id: string;
  /** The blocked table, or null when the whole restaurant is blocked. */
  table: { id: string; label: string; zone: TableZone } | null;
  /** The exact moments, in UTC. */
  startsAt: string;
  endsAt: string;
  /**
   * The same moments on the restaurant's calendar and clock, ready to show. A whole date runs from
   * 00:00 to 00:00 on the next day.
   */
  starts: { date: string; time: string };
  ends: { date: string; time: string };
  reason: string | null;
}

export interface OwnerBlockList {
  data: OwnerBlock[];
  meta: { page: number; pageSize: number; total: number };
}

const blockFields = {
  id: true,
  startsAt: true,
  endsAt: true,
  reason: true,
  table: { select: { id: true, label: true, zone: true } },
  restaurant: { select: { timezone: true } },
} satisfies Prisma.BlockedPeriodSelect;

type BlockRow = Prisma.BlockedPeriodGetPayload<{ select: typeof blockFields }>;

function toOwnerBlock(row: BlockRow): OwnerBlock {
  const timeZone = row.restaurant.timezone;
  const local = (moment: Date): { date: string; time: string } => ({
    date: localDate(moment, timeZone),
    time: localClockTime(moment, timeZone),
  });
  return {
    id: row.id,
    table: row.table ? { id: row.table.id, label: row.table.label, zone: row.table.zone } : null,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    starts: local(row.startsAt),
    ends: local(row.endsAt),
    reason: row.reason,
  };
}

/**
 * The blocks that aren't over yet, by when they start. The restaurant is the one
 * requireRestaurantOwner checked, so its id is enough here.
 */
export async function listBlocks(
  restaurantId: string,
  { page, pageSize }: BlockListQuery,
  now: Date = new Date(),
): Promise<OwnerBlockList> {
  const where = { restaurantId, endsAt: { gt: now } } satisfies Prisma.BlockedPeriodWhereInput;
  // Both reads in one transaction at REPEATABLE READ, so the page and the total match.
  const [rows, total] = await prisma.$transaction(
    [
      prisma.blockedPeriod.findMany({
        where,
        select: blockFields,
        // The id breaks ties, so no block shows on two pages.
        orderBy: [{ startsAt: "asc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.blockedPeriod.count({ where }),
    ],
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
  return { data: rows.map(toOwnerBlock), meta: { page, pageSize, total } };
}

/**
 * Locks every table of the restaurant, in ascending id order, then the restaurant's row, and reads
 * its time zone. A table added at this very moment can't be in the first lock yet, but the second
 * covers it: a booking takes a shared lock on its restaurant's row after its table's, before it
 * checks for blocks (task 6.5), so it waits here. No owner, no row: someone else's is not found.
 */
async function lockWholeRestaurant(
  tx: Prisma.TransactionClient,
  ownerId: string,
  restaurantId: string,
): Promise<string | null> {
  await tx.$queryRaw`
    SELECT t."id" FROM "Table" t JOIN "Restaurant" r ON r."id" = t."restaurantId"
    WHERE t."restaurantId" = ${restaurantId} AND r."ownerId" = ${ownerId}
    ORDER BY t."id" FOR UPDATE OF t`;
  const rows = await tx.$queryRaw<{ timezone: string }[]>`
    SELECT "timezone" FROM "Restaurant" WHERE "id" = ${restaurantId} AND "ownerId" = ${ownerId} FOR UPDATE`;
  return rows[0]?.timezone ?? null;
}

/** The time the owner asked for. The schema lets only a date or a time range through. */
function blockTime({ date, from, to }: CreateBlockInput): BlockTime {
  if (date !== undefined) return { date };
  if (from !== undefined && to !== undefined) return { from, to };
  throw new Error("createBlockSchema lets only a date or a time range through.");
}

/**
 * Blocks one table, or the whole restaurant, for a date or a time range. Bookings that fall inside
 * it are listed, and nothing is saved (409).
 *
 * Locks come first, then the checks, then the save, in one transaction. A table block locks that
 * table's row, the same lock a booking for it takes, so the two take turns: whichever comes second
 * sees the other. A whole-restaurant block locks every table, then the restaurant.
 */
export async function addBlock(
  ownerId: string,
  restaurantId: string,
  input: CreateBlockInput,
  now: Date = new Date(),
): Promise<OwnerBlock> {
  const tableId = input.tableId ?? null;
  return prisma.$transaction(async (tx) => {
    const timeZone = tableId
      ? (await lockOwnedTable(tx, ownerId, restaurantId, tableId))?.timezone
      : await lockWholeRestaurant(tx, ownerId, restaurantId);
    if (!timeZone) throw new NotFoundError(tableId ? "TABLE_NOT_FOUND" : "RESTAURANT_NOT_FOUND");

    const time = blockTime(input);
    const range = blockRange(time, timeZone);
    const problem = blockRangeProblem(range, now);
    if (problem) {
      throw new ValidationError("VALIDATION_ERROR", undefined, {
        fields: { ["date" in time ? "date" : "to"]: problem },
      });
    }

    // Bookings inside it: still holding a table, overlapping the block, and not over yet. Touching
    // isn't overlapping: a booking that ends at 14:30 leaves a block from 14:30 free.
    const inside = await tx.reservation.findMany({
      where: {
        restaurantId,
        ...(tableId ? { tableId } : {}),
        status: { in: ACTIVE_STATUSES },
        startsAt: { lt: range.endsAt },
        endsAt: { gt: range.startsAt > now ? range.startsAt : now },
      },
      select: ownerReservationFields,
      orderBy: [{ startsAt: "asc" }, { table: { label: "asc" } }, { id: "asc" }],
    });
    if (inside.length > 0) {
      throw new ConflictError("BLOCK_HAS_BOOKINGS", blockRefusalMessage(inside.length), {
        reservations: inside.map((booking) => toOwnerReservation(booking, timeZone)),
      });
    }

    const row = await tx.blockedPeriod.create({
      data: {
        restaurantId,
        tableId,
        startsAt: range.startsAt,
        endsAt: range.endsAt,
        reason: input.reason ?? null,
      },
      select: blockFields,
    });
    return toOwnerBlock(row);
  });
}

/**
 * Removes one of the restaurant's blocks. Removing only frees time, so it takes no lock. The
 * restaurant and its owner are part of the query: anyone else's block is not found.
 */
export async function removeBlock(
  ownerId: string,
  restaurantId: string,
  blockId: string,
): Promise<void> {
  const { count } = await prisma.blockedPeriod.deleteMany({
    where: { id: blockId, restaurantId, restaurant: { ownerId } },
  });
  if (count === 0) throw new NotFoundError("BLOCK_NOT_FOUND");
}
