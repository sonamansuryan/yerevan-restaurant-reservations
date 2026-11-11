// Every change to a booking goes through here, so the double-booking rules live in one place.
// A guest's own list of bookings is read here too.
import { Prisma } from "../../generated/prisma/client.ts";
import type { CancelledBy, ReservationStatus, TableZone } from "../../generated/prisma/enums.ts";
import { isExclusionViolation } from "../../lib/db-errors.ts";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors.ts";
import type { AppError } from "../../lib/errors.ts";
import { prisma } from "../../lib/prisma.ts";
import { localClockTime, localDate } from "../../lib/time.ts";
import { generateSlots, tableProblem } from "../availability/availability.rules.ts";
import type { TableProblem } from "../availability/availability.rules.ts";
import type { StatusChangeInput } from "./owner.schemas.ts";
import { ownerReservationFields, toOwnerReservation } from "./owner.service.ts";
import type { OwnerReservation } from "./owner.service.ts";
import {
  ACTIVE_STATUSES,
  canGuestCancel,
  EARLY_ARRIVAL_MINUTES,
  GUEST_CANCELLABLE,
  RESTAURANT_CHANGES_FROM,
  restaurantChangeProblem,
} from "./reservations.rules.ts";
import type { ChangeProblem, RestaurantChange } from "./reservations.rules.ts";
import type { CreateReservationInput, GuestReservationListQuery } from "./reservations.schemas.ts";

/** A booking as the guest who made it sees it. */
export interface GuestReservation {
  id: string;
  status: ReservationStatus;
  partySize: number;
  /** The day it's for, on the restaurant's calendar. */
  date: string;
  startsAt: string;
  endsAt: string;
  /** On the restaurant's clock, ready to show, such as "23:30" and "01:00". */
  starts: string;
  ends: string;
  restaurant: { slug: string; name: string };
  table: { label: string; zone: TableZone };
  specialRequests: string | null;
  /** Who cancelled, and why, for a cancelled booking. Otherwise null. */
  cancellation: { by: CancelledBy | null; reason: string | null } | null;
  /** Whether the guest can still cancel it: pending or confirmed, and not started yet. */
  canCancel: boolean;
}

/** One page of a guest's bookings. */
export interface GuestReservationList {
  data: GuestReservation[];
  meta: { page: number; pageSize: number; total: number };
}

interface LockedTable {
  id: string;
  restaurantId: string;
  label: string;
  zone: TableZone;
  capacity: number;
  minCapacity: number;
  isActive: boolean;
}

interface LockedRestaurant {
  slug: string;
  name: string;
  timezone: string;
  slotIntervalMin: number;
  reservationDurationMin: number;
  isPublished: boolean;
}

/**
 * Books a table for a guest, as PENDING until the restaurant confirms it.
 *
 * One transaction: it locks the table's row, so everything that changes this table takes turns,
 * then takes a shared lock on the restaurant's row, which a whole-restaurant block holds while it
 * checks every table (PROJECT_PLAN.md §5.4). Only then does it run the four checks, so they see
 * whatever was saved before. If the overlap constraint still refuses the booking, that's a real
 * conflict too. Any other database error is left to become a 500.
 */
export async function createReservation(
  userId: string,
  input: CreateReservationInput,
  now: Date = new Date(),
): Promise<GuestReservation> {
  try {
    return await prisma.$transaction(async (tx) => {
      const [table] = await tx.$queryRaw<LockedTable[]>`
        SELECT "id", "restaurantId", "label", "zone", "capacity", "minCapacity", "isActive"
        FROM "Table" WHERE "id" = ${input.tableId}
        FOR UPDATE`;
      if (!table) throw new NotFoundError("TABLE_NOT_FOUND");

      const [restaurant] = await tx.$queryRaw<LockedRestaurant[]>`
        SELECT "slug", "name", "timezone", "slotIntervalMin", "reservationDurationMin", "isPublished"
        FROM "Restaurant" WHERE "id" = ${table.restaurantId}
        FOR KEY SHARE`;
      // Guests only see published restaurants, so any other table isn't there for them.
      if (!restaurant?.isPublished) throw new NotFoundError("TABLE_NOT_FOUND");

      // Is the restaurant open? Only a time generateSlots offers can be booked.
      const openingHours = await tx.openingHour.findMany({
        where: { restaurantId: table.restaurantId },
        select: { dayOfWeek: true, opensAt: true, closesAt: true },
      });
      const slot = generateSlots({ ...restaurant, openingHours }, input.date, now).find(
        (offered) => offered.starts === input.time,
      );
      if (!slot) {
        throw fieldError("time", "This time can't be booked. Choose one of the times offered.");
      }

      // Does the table suit the party, and is it neither reserved nor blocked then?
      const during = { startsAt: { lt: slot.endsAt }, endsAt: { gt: slot.startsAt } };
      const reservations = await tx.reservation.findMany({
        where: { tableId: table.id, status: { in: ACTIVE_STATUSES }, ...during },
        select: { tableId: true, status: true, startsAt: true, endsAt: true },
      });
      const blocks = await tx.blockedPeriod.findMany({
        where: {
          restaurantId: table.restaurantId,
          OR: [{ tableId: null }, { tableId: table.id }],
          ...during,
        },
        select: { tableId: true, startsAt: true, endsAt: true },
      });
      const booking = { partySize: input.partySize, startsAt: slot.startsAt, endsAt: slot.endsAt };
      const problem = tableProblem(table, booking, { reservations, blocks });
      if (problem) throw refusal(problem);

      const specialRequests = input.specialRequests ?? null;
      const saved = await tx.reservation.create({
        data: {
          // The restaurant comes from the locked table, never from the request.
          restaurantId: table.restaurantId,
          tableId: table.id,
          userId,
          partySize: input.partySize,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          status: "PENDING",
          specialRequests,
        },
        select: { id: true, status: true },
      });
      return {
        ...saved,
        partySize: input.partySize,
        date: input.date,
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        starts: slot.starts,
        ends: localClockTime(slot.endsAt, restaurant.timezone),
        restaurant: { slug: restaurant.slug, name: restaurant.name },
        table: { label: table.label, zone: table.zone },
        specialRequests,
        cancellation: null,
        canCancel: canGuestCancel({ status: saved.status, startsAt: slot.startsAt }, now),
      };
    });
  } catch (error) {
    // The database refused an overlap: someone else got the table first.
    if (isExclusionViolation(error)) throw new ConflictError("SLOT_TAKEN");
    throw error;
  }
}

/** What a guest sees of their booking, and the restaurant's time zone to show its times in. */
const guestReservationFields = {
  id: true,
  status: true,
  partySize: true,
  startsAt: true,
  endsAt: true,
  specialRequests: true,
  cancelledBy: true,
  cancellationReason: true,
  restaurant: { select: { slug: true, name: true, timezone: true } },
  table: { select: { label: true, zone: true } },
} satisfies Prisma.ReservationSelect;

type GuestReservationRow = Prisma.ReservationGetPayload<{ select: typeof guestReservationFields }>;

/**
 * One page of the signed-in guest's own bookings, every status included. Upcoming ones aren't
 * over yet, so a meal in progress still counts, and come soonest first. Past ones are over, and
 * come latest first.
 */
export async function listGuestReservations(
  userId: string,
  { when, page, pageSize }: GuestReservationListQuery,
  now: Date = new Date(),
): Promise<GuestReservationList> {
  const upcoming = when === "upcoming";
  const where = {
    userId,
    endsAt: upcoming ? { gt: now } : { lte: now },
  } satisfies Prisma.ReservationWhereInput;

  // Both reads in one transaction at REPEATABLE READ, so the page and the total come from the same
  // moment, even if the guest books or cancels in between.
  const [rows, total] = await prisma.$transaction(
    [
      prisma.reservation.findMany({
        where,
        select: guestReservationFields,
        // The id breaks ties, so no booking shows on two pages.
        orderBy: [{ startsAt: upcoming ? "asc" : "desc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.reservation.count({ where }),
    ],
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );

  return {
    data: rows.map((row) => toGuestReservation(row, now)),
    meta: { page, pageSize, total },
  };
}

/**
 * Cancels one of the guest's own bookings while it's still pending or confirmed and hasn't started
 * (PROJECT_PLAN.md §5.3). Someone else's booking is not found.
 *
 * A compare-and-set, with no lock, because cancelling only frees a table. The update names the
 * statuses it may change from, so it never overwrites a booking that has moved on. If two cancels
 * arrive at once, or the restaurant has just cancelled the booking or marked the guest arrived,
 * this one finds nothing to update and is told why.
 */
export async function cancelReservation(
  userId: string,
  reservationId: string,
  now: Date = new Date(),
): Promise<GuestReservation> {
  const { count } = await prisma.reservation.updateMany({
    where: {
      id: reservationId,
      userId,
      status: { in: GUEST_CANCELLABLE },
      startsAt: { gt: now },
    },
    data: { status: "CANCELLED", cancelledBy: "CUSTOMER", cancelledAt: now },
  });

  // Read back as it is now: cancelled by this request, or the reason it couldn't be.
  const row = await prisma.reservation.findUnique({
    where: { id: reservationId, userId },
    select: guestReservationFields,
  });
  if (!row) throw new NotFoundError("RESERVATION_NOT_FOUND");
  if (count === 0) {
    throw new ConflictError(row.status === "CANCELLED" ? "ALREADY_CANCELLED" : "CANCEL_TOO_LATE");
  }
  return toGuestReservation(row, now);
}

/** What the owner sees of a booking, and the restaurant's time zone to show its times in. */
const ownerReservationWithZone = {
  ...ownerReservationFields,
  restaurant: { select: { timezone: true } },
} satisfies Prisma.ReservationSelect;

/**
 * The restaurant moves one of its bookings on: confirmed, cancelled (with an optional reason the
 * guest sees), arrived or no-show (PROJECT_PLAN.md §5.3). Only this owner's restaurant's bookings
 * are found.
 *
 * No change here takes a table: confirming and arriving keep the one the booking holds, and the
 * others free it. So nothing is locked. The rules are checked on the booking as it is, then the
 * update applies only if its status is still one the change may come from: a compare-and-set. If
 * someone changed the booking in between, such as the guest cancelling it, this change finds
 * nothing to update and is told why.
 */
export async function changeReservationStatus(
  ownerId: string,
  restaurantId: string,
  reservationId: string,
  { status: change, reason }: StatusChangeInput,
  now: Date = new Date(),
): Promise<OwnerReservation> {
  // The owner again, as in every owner query, even though requireRestaurantOwner has checked.
  const theBooking = {
    id: reservationId,
    restaurantId,
    restaurant: { ownerId },
  } satisfies Prisma.ReservationWhereInput;

  const before = await prisma.reservation.findFirst({
    where: theBooking,
    select: { status: true, startsAt: true, endsAt: true },
  });
  if (!before) throw new NotFoundError("RESERVATION_NOT_FOUND");
  const problem = restaurantChangeProblem(before, change, now);
  if (problem) throw changeRefusal(problem, before.status, change);

  const { count } = await prisma.reservation.updateMany({
    where: { ...theBooking, status: { in: RESTAURANT_CHANGES_FROM[change] } },
    data:
      change === "CANCELLED"
        ? {
            status: change,
            cancelledBy: "RESTAURANT",
            cancelledAt: now,
            cancellationReason: reason ?? null,
          }
        : { status: change },
  });

  // Read back as it is now: changed by this request, or the reason it couldn't be.
  const after = await prisma.reservation.findFirst({
    where: theBooking,
    select: ownerReservationWithZone,
  });
  // Bookings are never deleted, so it's still there.
  if (!after) throw new NotFoundError("RESERVATION_NOT_FOUND");
  if (count === 0) {
    // Someone else moved it on a moment ago. Statuses only move forward, so the reason is the
    // status it has now.
    throw changeRefusal(
      restaurantChangeProblem(after, change, now) ?? "WRONG_STATUS",
      after.status,
      change,
    );
  }
  return toOwnerReservation(after, after.restaurant.timezone, now);
}

/** For a change the status doesn't allow: what the booking already is. */
const STATUS_REFUSALS: Record<ReservationStatus, string> = {
  PENDING: "NOT_CONFIRMED",
  CONFIRMED: "ALREADY_CONFIRMED",
  ARRIVED: "ALREADY_ARRIVED",
  NO_SHOW: "ALREADY_NO_SHOW",
  CANCELLED: "ALREADY_CANCELLED",
};

/** What the restaurant is told when a change can't be made. */
function changeRefusal(
  problem: ChangeProblem,
  status: ReservationStatus,
  change: RestaurantChange,
): AppError {
  switch (problem) {
    case "WRONG_STATUS":
      return new ConflictError(STATUS_REFUSALS[status]);
    case "TOO_LATE":
      return new ConflictError(change === "ARRIVED" ? "ARRIVAL_TOO_LATE" : "CONFIRM_TOO_LATE");
    case "TOO_EARLY":
      return change === "ARRIVED"
        ? new ConflictError(
            "ARRIVAL_TOO_EARLY",
            `A guest can be marked as arrived from ${EARLY_ARRIVAL_MINUTES} minutes before their booking.`,
          )
        : new ConflictError("NO_SHOW_TOO_EARLY");
  }
}

/** A booking as the guest sees it, with its times on the restaurant's clock. */
function toGuestReservation(row: GuestReservationRow, now: Date): GuestReservation {
  const timeZone = row.restaurant.timezone;
  return {
    id: row.id,
    status: row.status,
    partySize: row.partySize,
    // Bookings start before midnight, so the day it starts is the day it's for.
    date: localDate(row.startsAt, timeZone),
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    starts: localClockTime(row.startsAt, timeZone),
    ends: localClockTime(row.endsAt, timeZone),
    restaurant: { slug: row.restaurant.slug, name: row.restaurant.name },
    table: { label: row.table.label, zone: row.table.zone },
    specialRequests: row.specialRequests,
    cancellation:
      row.status === "CANCELLED" ? { by: row.cancelledBy, reason: row.cancellationReason } : null,
    canCancel: canGuestCancel(row, now),
  };
}

/** What the guest is told when the table can't take their booking. */
function refusal(problem: TableProblem): AppError {
  switch (problem) {
    case "BOOKED":
      return new ConflictError("SLOT_TAKEN");
    case "BLOCKED":
      return new ConflictError("TABLE_BLOCKED");
    case "INACTIVE":
      return new NotFoundError("TABLE_NOT_FOUND");
    case "TOO_SMALL":
    case "TOO_BIG":
      return fieldError("partySize", "This table doesn't fit your party. Choose another table.");
  }
}

function fieldError(field: string, message: string): ValidationError {
  return new ValidationError("VALIDATION_ERROR", undefined, { fields: { [field]: message } });
}
