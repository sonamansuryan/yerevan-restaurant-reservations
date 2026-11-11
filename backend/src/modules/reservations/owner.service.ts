// A restaurant's bookings for one day, as its owner sees them in the dashboard. This file only
// reads: every change to a booking goes through reservations.service.ts.
import { Prisma } from "../../generated/prisma/client.ts";
import type { CancelledBy, ReservationStatus, TableZone } from "../../generated/prisma/enums.ts";
import { NotFoundError } from "../../lib/errors.ts";
import { prisma } from "../../lib/prisma.ts";
import { localClockTime, localDayRange } from "../../lib/time.ts";
import type { ReservationDayQuery } from "./owner.schemas.ts";
import { RESTAURANT_CHANGES, restaurantChangeProblem } from "./reservations.rules.ts";
import type { RestaurantChange } from "./reservations.rules.ts";

/** One booking in the restaurant's book for the day. */
export interface OwnerReservation {
  id: string;
  status: ReservationStatus;
  partySize: number;
  /** The exact moments, in UTC. */
  startsAt: string;
  endsAt: string;
  /** The same two moments on the restaurant's clock, ready to show, such as "19:00" and "01:30". */
  starts: string;
  ends: string;
  table: { id: string; label: string; zone: TableZone };
  /** The guest's name only. Their email and phone stay on the server until a task needs them. */
  guest: { name: string };
  specialRequests: string | null;
  /** Who cancelled, and why, for a cancelled booking. Otherwise null. */
  cancellation: { by: CancelledBy | null; reason: string | null } | null;
  /**
   * The changes the restaurant can make to it now (PROJECT_PLAN.md §5.3), so the dashboard offers
   * only those. The server still checks each one when it's made.
   */
  actions: RestaurantChange[];
}

export interface OwnerReservationList {
  data: OwnerReservation[];
  meta: { page: number; pageSize: number; total: number };
}

/** What an owner sees of a booking. Tables reuse it to list the bookings that need a table. */
export const ownerReservationFields = {
  id: true,
  status: true,
  partySize: true,
  startsAt: true,
  endsAt: true,
  specialRequests: true,
  cancelledBy: true,
  cancellationReason: true,
  table: { select: { id: true, label: true, zone: true } },
  user: { select: { name: true } },
} satisfies Prisma.ReservationSelect;

type ReservationRow = Prisma.ReservationGetPayload<{ select: typeof ownerReservationFields }>;

/**
 * One day's bookings at one of this owner's restaurants, every status included, by time and then
 * table. A booking belongs to the date it starts on, in the restaurant's own time zone. Bookings
 * start before midnight (PROJECT_PLAN.md §5.2), so one from 23:00 to 01:00 is that evening's.
 */
export async function listReservationsForDay(
  ownerId: string,
  restaurantId: string,
  { date, page, pageSize }: ReservationDayQuery,
  now: Date = new Date(),
): Promise<OwnerReservationList> {
  // The owner again, as in every owner query, even though requireRestaurantOwner has checked.
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId, ownerId },
    select: { timezone: true },
  });
  if (!restaurant) throw new NotFoundError("RESTAURANT_NOT_FOUND");

  const { start, end } = localDayRange(date, restaurant.timezone);
  const where = {
    restaurantId,
    startsAt: { gte: start, lt: end },
  } satisfies Prisma.ReservationWhereInput;

  // Both reads in one transaction at REPEATABLE READ, so the page and the total come from the same
  // moment, even if a guest books in between.
  const [rows, total] = await prisma.$transaction(
    [
      prisma.reservation.findMany({
        where,
        select: ownerReservationFields,
        // The id breaks ties, so no booking shows on two pages.
        orderBy: [{ startsAt: "asc" }, { table: { label: "asc" } }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.reservation.count({ where }),
    ],
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );

  return {
    data: rows.map((row) => toOwnerReservation(row, restaurant.timezone, now)),
    meta: { page, pageSize, total },
  };
}

export function toOwnerReservation(
  row: ReservationRow,
  timeZone: string,
  now: Date = new Date(),
): OwnerReservation {
  return {
    id: row.id,
    status: row.status,
    partySize: row.partySize,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    starts: localClockTime(row.startsAt, timeZone),
    ends: localClockTime(row.endsAt, timeZone),
    table: { id: row.table.id, label: row.table.label, zone: row.table.zone },
    guest: { name: row.user.name },
    specialRequests: row.specialRequests,
    cancellation:
      row.status === "CANCELLED" ? { by: row.cancelledBy, reason: row.cancellationReason } : null,
    actions: RESTAURANT_CHANGES.filter(
      (change) => restaurantChangeProblem(row, change, now) === null,
    ),
  };
}
