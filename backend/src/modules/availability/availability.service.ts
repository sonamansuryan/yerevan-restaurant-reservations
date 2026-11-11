// The times and tables guests can book at a restaurant on a date. The rules themselves are in
// availability.rules.ts: this reads what they need, and turns their answer into the reply.
import { Prisma } from "../../generated/prisma/client.ts";
import type { TableZone } from "../../generated/prisma/enums.ts";
import { NotFoundError } from "../../lib/errors.ts";
import { prisma } from "../../lib/prisma.ts";
import { localClockTime } from "../../lib/time.ts";
import { ACTIVE_STATUSES } from "../reservations/reservations.rules.ts";
import { bookingWindow, findFreeTables, generateSlots } from "./availability.rules.ts";
import type { AvailabilityQuery } from "./availability.schemas.ts";

/** A table a guest can book at one start time. */
export interface AvailableTable {
  id: string;
  label: string;
  zone: TableZone;
  /** The most guests it takes. */
  capacity: number;
}

/** A time a booking can start, with the tables free for the whole booking. */
export interface AvailabilitySlot {
  startsAt: string;
  endsAt: string;
  /** On the restaurant's clock, ready to show, such as "23:30" and "01:00". */
  starts: string;
  ends: string;
  /** Empty when every table that fits the party is taken then. */
  tables: AvailableTable[];
}

export interface Availability {
  date: string;
  partySize: number;
  /** The first and last dates guests can book, today and 60 days later, for a date picker. */
  bookingWindow: { first: string; last: string };
  slots: AvailabilitySlot[];
}

/**
 * Every time a booking can start at a published restaurant on a date, each with the tables free
 * for the party then. A time with no free table is still listed, so guests can see it's full. A
 * date with no times, such as a closed day or one outside the booking window, has none.
 *
 * This is only a preview: a table shown free can be booked a moment later, so booking checks
 * again under the table's lock.
 */
export async function getAvailability(
  slug: string,
  { date, partySize }: AvailabilityQuery,
  now: Date = new Date(),
): Promise<Availability> {
  // Only published restaurants can be booked. Any other answers 404, as on its page.
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug, isPublished: true },
    select: {
      id: true,
      timezone: true,
      slotIntervalMin: true,
      reservationDurationMin: true,
      openingHours: { select: { dayOfWeek: true, opensAt: true, closesAt: true } },
    },
  });
  if (!restaurant) throw new NotFoundError("RESTAURANT_NOT_FOUND");

  const reply = { date, partySize, bookingWindow: bookingWindow(now, restaurant.timezone) };
  const slots = generateSlots(restaurant, date, now);
  if (slots.length === 0) return { ...reply, slots: [] };

  // What holds a table at any moment from the first start to the last end, which can be after
  // midnight. The three reads share one transaction at REPEATABLE READ, so they see one moment: a
  // booking made in between can't show up in one list and be missing from another.
  const from = new Date(Math.min(...slots.map((slot) => slot.startsAt.getTime())));
  const until = new Date(Math.max(...slots.map((slot) => slot.endsAt.getTime())));
  const during = { startsAt: { lt: until }, endsAt: { gt: from } };
  const [tables, reservations, blocks] = await prisma.$transaction(
    [
      prisma.table.findMany({
        where: { restaurantId: restaurant.id, isActive: true },
        select: {
          id: true,
          label: true,
          zone: true,
          capacity: true,
          minCapacity: true,
          isActive: true,
        },
        // The order the owner added them, as on their Tables page.
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
      prisma.reservation.findMany({
        where: { restaurantId: restaurant.id, status: { in: ACTIVE_STATUSES }, ...during },
        select: { tableId: true, status: true, startsAt: true, endsAt: true },
      }),
      prisma.blockedPeriod.findMany({
        where: { restaurantId: restaurant.id, ...during },
        select: { tableId: true, startsAt: true, endsAt: true },
      }),
    ],
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );

  return {
    ...reply,
    slots: slots.map((slot) => {
      const booking = { partySize, startsAt: slot.startsAt, endsAt: slot.endsAt };
      const free = findFreeTables(tables, booking, { reservations, blocks });
      return {
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        starts: slot.starts,
        ends: localClockTime(slot.endsAt, restaurant.timezone),
        // Only what a guest needs: not the seat minimum, and never a database row.
        tables: free.map(({ id, label, zone, capacity }) => ({ id, label, zone, capacity })),
      };
    }),
  };
}
