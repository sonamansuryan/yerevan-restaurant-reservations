// Every change to a booking goes through here, so the double-booking rules live in one place.
import type { ReservationStatus, TableZone } from "../../generated/prisma/enums.ts";
import { isExclusionViolation } from "../../lib/db-errors.ts";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors.ts";
import type { AppError } from "../../lib/errors.ts";
import { prisma } from "../../lib/prisma.ts";
import { localClockTime } from "../../lib/time.ts";
import { generateSlots, tableProblem } from "../availability/availability.rules.ts";
import type { TableProblem } from "../availability/availability.rules.ts";
import { ACTIVE_STATUSES } from "./reservations.rules.ts";
import type { CreateReservationInput } from "./reservations.schemas.ts";

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
      };
    });
  } catch (error) {
    // The database refused an overlap: someone else got the table first.
    if (isExclusionViolation(error)) throw new ConflictError("SLOT_TAKEN");
    throw error;
  }
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
