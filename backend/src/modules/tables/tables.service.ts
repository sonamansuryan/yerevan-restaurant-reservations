// A restaurant's tables. Every booking holds one table, so a change that would let an upcoming
// booking down is refused. Tables are never deleted, only deactivated, so their bookings' history
// stays whole. A published restaurant always keeps at least one active table.
//
// Lock order, the same in every change: table rows first, then the restaurant's row. Whatever
// holds a restaurant's row (publishing, opening hours, photos, adding a table) never then waits
// for a table's, so no two changes can ever wait on each other forever. A booking will hold its
// table, then need its restaurant (for the foreign key), in the same order.
import { Prisma } from "../../generated/prisma/client.ts";
import type { TableZone } from "../../generated/prisma/enums.ts";
import { isUniqueViolation } from "../../lib/db-errors.ts";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors.ts";
import { prisma } from "../../lib/prisma.ts";
import { ownerReservationFields, toOwnerReservation } from "../reservations/owner.service.ts";
import { ACTIVE_STATUSES } from "../reservations/reservations.rules.ts";
import { lockOwnedRestaurant } from "../restaurants/owner.service.ts";
import {
  LAST_ACTIVE_TABLE,
  bookingsInTheWay,
  isDeactivating,
  mayAffectBookings,
  refusalMessage,
  seatsAfter,
} from "./tables.rules.ts";
import type { SavedTable } from "./tables.rules.ts";
import { MIN_ABOVE_SEATS } from "./tables.schemas.ts";
import type { CreateTableInput, TableListQuery, UpdateTableInput } from "./tables.schemas.ts";

/** A table as its owner manages it. */
export interface OwnerTable {
  id: string;
  label: string;
  capacity: number;
  minCapacity: number;
  zone: TableZone;
  isActive: boolean;
}

export interface OwnerTableList {
  data: OwnerTable[];
  meta: { page: number; pageSize: number; total: number };
}

const tableFields = {
  id: true,
  label: true,
  capacity: true,
  minCapacity: true,
  zone: true,
  isActive: true,
} satisfies Prisma.TableSelect;

type TableRow = Prisma.TableGetPayload<{ select: typeof tableFields }>;

function toOwnerTable(row: TableRow): OwnerTable {
  return {
    id: row.id,
    label: row.label,
    capacity: row.capacity,
    minCapacity: row.minCapacity,
    zone: row.zone,
    isActive: row.isActive,
  };
}

// A deactivated table keeps its name, so the name is taken until that table is renamed.
const labelTaken = (): ConflictError =>
  new ConflictError(
    "TABLE_LABEL_TAKEN",
    "Another table already has this name. If it's deactivated, activate it again instead.",
  );

/**
 * One restaurant's tables, active and inactive, in the order they were added. The restaurant is
 * the one requireRestaurantOwner checked, so its id is enough here.
 */
export async function listTables(
  restaurantId: string,
  { page, pageSize }: TableListQuery,
): Promise<OwnerTableList> {
  const where = { restaurantId } satisfies Prisma.TableWhereInput;
  // Both reads in one transaction at REPEATABLE READ, so the page and the total match.
  const [rows, total] = await prisma.$transaction(
    [
      prisma.table.findMany({
        where,
        select: tableFields,
        // The id breaks ties, so no table shows on two pages.
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.table.count({ where }),
    ],
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
  return { data: rows.map(toOwnerTable), meta: { page, pageSize, total } };
}

/** Adds a table to one of the owner's restaurants. It can be booked straight away. */
export async function addTable(
  ownerId: string,
  restaurantId: string,
  input: CreateTableInput,
): Promise<OwnerTable> {
  try {
    return await prisma.$transaction(async (tx) => {
      // The owner is part of the lock, as in every owner query. No other row is locked here.
      if (!(await lockOwnedRestaurant(tx, ownerId, restaurantId))) {
        throw new NotFoundError("RESTAURANT_NOT_FOUND");
      }
      const row = await tx.table.create({
        data: { restaurantId, ...input },
        select: tableFields,
      });
      return toOwnerTable(row);
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw labelTaken();
    throw error;
  }
}

/** The table, locked, with its restaurant's time zone for the bookings it may have to list. */
export interface LockedTable extends SavedTable {
  timezone: string;
}

/**
 * Locks one table's row, the same lock a booking takes (PROJECT_PLAN.md §5.4). It's always the
 * first lock a table change takes. The restaurant and its owner are part of the query: anyone
 * else's table is not found.
 */
export async function lockOwnedTable(
  tx: Prisma.TransactionClient,
  ownerId: string,
  restaurantId: string,
  tableId: string,
): Promise<LockedTable | null> {
  const rows = await tx.$queryRaw<LockedTable[]>`
    SELECT t."capacity", t."minCapacity", t."isActive", r."timezone"
    FROM "Table" t JOIN "Restaurant" r ON r."id" = t."restaurantId"
    WHERE t."id" = ${tableId} AND t."restaurantId" = ${restaurantId} AND r."ownerId" = ${ownerId}
    FOR UPDATE OF t`;
  return rows[0] ?? null;
}

/**
 * Locks the restaurant's row, after its table's, and reads whether it's published. Publishing
 * takes the same lock, so while a deactivation holds it, the restaurant can't be published, and
 * once it's free, publishing counts the tables again.
 */
async function lockRestaurantAfterTable(
  tx: Prisma.TransactionClient,
  ownerId: string,
  restaurantId: string,
): Promise<{ isPublished: boolean } | null> {
  const rows = await tx.$queryRaw<{ isPublished: boolean }[]>`
    SELECT "isPublished" FROM "Restaurant" WHERE "id" = ${restaurantId} AND "ownerId" = ${ownerId} FOR UPDATE`;
  return rows[0] ?? null;
}

/**
 * Changes one table: its details, or whether it can be booked. A change that would let an
 * upcoming booking down is refused, with those bookings listed. So is switching off a published
 * restaurant's last active table.
 *
 * The checks and the change are one transaction that first locks the table's row. A booking for
 * this table takes the same lock, so the two take turns: either the booking comes first and this
 * sees it, or this comes first and the booking finds the table as changed. Switching a table off
 * also locks the restaurant's row, second, as publishing does, so the two can't cross.
 */
export async function updateTable(
  ownerId: string,
  restaurantId: string,
  tableId: string,
  changes: UpdateTableInput,
  now: Date = new Date(),
): Promise<OwnerTable> {
  try {
    return await prisma.$transaction(async (tx) => {
      const table = await lockOwnedTable(tx, ownerId, restaurantId, tableId);
      if (!table) throw new NotFoundError("TABLE_NOT_FOUND");
      // Only switching a table off can leave a published restaurant without one, so only that
      // takes the restaurant's lock as well. Every lock comes before any check.
      const deactivating = isDeactivating(table, changes);
      const restaurant = deactivating
        ? await lockRestaurantAfterTable(tx, ownerId, restaurantId)
        : null;
      if (deactivating && !restaurant) throw new NotFoundError("RESTAURANT_NOT_FOUND");

      // Only one of the two may be sent, so the other is the saved one.
      const seats = seatsAfter(table, changes);
      if (seats.minCapacity > seats.capacity) {
        throw new ValidationError("VALIDATION_ERROR", undefined, {
          fields:
            changes.minCapacity === undefined
              ? { capacity: `Use at least ${seats.minCapacity}, the table's minimum seats.` }
              : { minCapacity: MIN_ABOVE_SEATS },
        });
      }

      if (mayAffectBookings(table, changes)) {
        // Upcoming: still holding the table, and not over yet. A meal in progress counts.
        const upcoming = await tx.reservation.findMany({
          where: { tableId, restaurantId, status: { in: ACTIVE_STATUSES }, endsAt: { gt: now } },
          select: ownerReservationFields,
          orderBy: [{ startsAt: "asc" }, { id: "asc" }],
        });
        const inTheWay = bookingsInTheWay(table, changes, upcoming);
        if (inTheWay) {
          throw new ConflictError(
            inTheWay.refusal,
            refusalMessage(inTheWay.refusal, inTheWay.bookings),
            {
              reservations: inTheWay.bookings.map((booking) =>
                toOwnerReservation(booking, table.timezone, now),
              ),
            },
          );
        }
      }

      if (restaurant?.isPublished) {
        // Counted while both locks are held, so no other table can be switched off meanwhile.
        const otherActiveTables = await tx.table.count({
          where: { restaurantId, isActive: true, id: { not: tableId } },
        });
        if (otherActiveTables === 0) {
          throw new ConflictError("LAST_ACTIVE_TABLE", LAST_ACTIVE_TABLE);
        }
      }

      const row = await tx.table.update({
        where: { id: tableId, restaurantId },
        data: changes,
        select: tableFields,
      });
      return toOwnerTable(row);
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw labelTaken();
    throw error;
  }
}
