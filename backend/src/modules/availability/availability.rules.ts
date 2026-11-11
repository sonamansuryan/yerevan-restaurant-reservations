// The rules for when a booking can start, and which tables are free then, that need no database.
// They're plain functions, so they're tested on their own. Times are the restaurant's own:
// lib/time.ts turns them into exact moments.
import type { ReservationStatus } from "../../generated/prisma/client.ts";
import {
  MINUTES_PER_DAY,
  addDays,
  dayOfWeek,
  localClockTime,
  localDate,
  localTimeToUtc,
  minutesToTime,
} from "../../lib/time.ts";
import type { Opening } from "../opening-hours/opening-hours.rules.ts";
import { ACTIVE_STATUSES } from "../reservations/reservations.rules.ts";

/** A booking starts at least this long from now, so the restaurant has time to prepare. */
export const MIN_NOTICE_MINUTES = 60;

/** How far ahead guests can book: today and the next 60 days, on the restaurant's calendar. */
export const MAX_DAYS_AHEAD = 60;

const MINUTE_MS = 60_000;

/** What the start times depend on. The names are the restaurant's own columns. */
export interface SlotSettings {
  timezone: string;
  /** Start times are offered every 15 or 30 minutes, counted from opening. */
  slotIntervalMin: number;
  /** How long one booking holds a table. */
  reservationDurationMin: number;
  /** The restaurant's whole week. Only the chosen date's weekday is used. */
  openingHours: readonly Opening[];
}

/** A time a booking can start. */
export interface Slot {
  /** The start on the restaurant's clock, such as "19:30". */
  starts: string;
  startsAt: Date;
  /** When the booking would end. It can be after midnight, on the next date. */
  endsAt: Date;
}

/**
 * The first and last dates guests can book, as YYYY-MM-DD: today and 60 days later. "Today" is
 * the restaurant's: at 01:00 on Saturday in Yerevan, it's still Friday in UTC.
 */
export function bookingWindow(now: Date, timeZone: string): { first: string; last: string } {
  const today = localDate(now, timeZone);
  return { first: today, last: addDays(today, MAX_DAYS_AHEAD) };
}

/**
 * The times a booking can start at a restaurant on a date, in order.
 *
 * Each of that weekday's openings offers a time every interval from opening, if a booking that
 * starts then ends by closing. So each shift has its own times, and lunch can't run into dinner.
 * Bookings start before midnight but may end after it, so hours past midnight (Friday 18:00 to
 * 02:00) let Friday's last bookings end then, and never add times to Saturday's date.
 *
 * A time also has to be at least an hour away, and the date no more than 60 days ahead. Whether a
 * table is free then is checked separately.
 */
export function generateSlots(restaurant: SlotSettings, date: string, now: Date): Slot[] {
  const { timezone, slotIntervalMin: interval, reservationDurationMin: duration } = restaurant;
  // The database only allows 15 or 30. A step of 0 would never move on, so the loop below would
  // run forever and freeze the server.
  if (!Number.isInteger(interval) || interval <= 0) {
    throw new Error(`A slot interval must be a whole number of minutes above 0, not ${interval}.`);
  }

  const weekday = dayOfWeek(date); // throws on a date that isn't YYYY-MM-DD
  const { first, last } = bookingWindow(now, timezone);
  // YYYY-MM-DD dates sort as text in calendar order.
  if (date < first || date > last) return [];

  const earliest = now.getTime() + MIN_NOTICE_MINUTES * MINUTE_MS;
  const openings = restaurant.openingHours
    .filter((opening) => opening.dayOfWeek === weekday)
    .sort((a, b) => a.opensAt - b.opensAt);

  const slots: Slot[] = [];
  for (const opening of openings) {
    const closesAt = localTimeToUtc(date, opening.closesAt, timezone);
    // A booking starts before closing, and before midnight.
    const startsBefore = Math.min(opening.closesAt, MINUTES_PER_DAY);
    for (let minutes = opening.opensAt; minutes < startsBefore; minutes += interval) {
      const starts = minutesToTime(minutes);
      const startsAt = localTimeToUtc(date, minutes, timezone);
      // On a night the clocks go forward, a time such as 02:30 never happens, and converting it
      // gives 03:30, a time offered anyway. Yerevan's clocks don't change, but nothing here
      // assumes that.
      if (localClockTime(startsAt, timezone) !== starts) continue;
      // A booking lasts a fixed length of real time, so plain addition is right here.
      const endsAt = new Date(startsAt.getTime() + duration * MINUTE_MS);
      if (endsAt > closesAt) continue; // still at the table after closing
      if (startsAt.getTime() < earliest) continue; // too soon, or already past
      slots.push({ starts, startsAt, endsAt });
    }
  }
  return slots;
}

/** A stretch of time, from startsAt up to but not including endsAt. */
export interface TimeRange {
  startsAt: Date;
  endsAt: Date;
}

/** The booking a guest wants: how many guests, and when. A Slot's times fit it. */
export interface WantedBooking extends TimeRange {
  partySize: number;
}

/** A table, as the free-table check reads it. The names are the Table columns'. */
export interface SeatedTable {
  id: string;
  /** The most guests it takes. */
  capacity: number;
  /** The fewest guests it takes. Smaller parties get another table. */
  minCapacity: number;
  /** The owner can switch a table off instead of deleting it. */
  isActive: boolean;
}

/** A booking already made. Only some statuses hold its table. */
export interface TableBooking extends TimeRange {
  tableId: string;
  status: ReservationStatus;
}

/** A time the owner blocked, on one table or, with no tableId, the whole restaurant. */
export interface TableBlock extends TimeRange {
  tableId: string | null;
}

/** What already holds the restaurant's tables around that time. */
export interface TakenTimes {
  reservations: readonly TableBooking[];
  blocks: readonly TableBlock[];
}

/**
 * Why a table can't take a booking: switched off, too small or too big for the party, or held then
 * by a booking or a block.
 */
export type TableProblem = "INACTIVE" | "TOO_SMALL" | "TOO_BIG" | "BOOKED" | "BLOCKED";

/**
 * Whether two stretches of time share a moment. Each includes its start but not its end, as in the
 * database's "Reservation_no_overlap", so one booking can start as another ends. The times are
 * exact moments, so a booking that runs past midnight needs nothing special.
 */
function overlaps(a: TimeRange, b: TimeRange): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

/**
 * The first reason a table can't take the booking, or null if it can. The checks run in the
 * assignment's order: a suitable table, not reserved, not blocked.
 */
export function tableProblem(
  table: SeatedTable,
  booking: WantedBooking,
  taken: TakenTimes,
): TableProblem | null {
  if (!table.isActive) return "INACTIVE";
  if (booking.partySize > table.capacity) return "TOO_SMALL";
  if (booking.partySize < table.minCapacity) return "TOO_BIG";

  // Pending, confirmed and arrived bookings hold their table. Cancelled and no-show ones free it.
  const booked = taken.reservations.some(
    (reservation) =>
      reservation.tableId === table.id &&
      ACTIVE_STATUSES.includes(reservation.status) &&
      overlaps(reservation, booking),
  );
  if (booked) return "BOOKED";

  const blocked = taken.blocks.some(
    (block) => (block.tableId === null || block.tableId === table.id) && overlaps(block, booking),
  );
  if (blocked) return "BLOCKED";

  return null;
}

/**
 * The tables that can take a booking: switched on, the right size for the party, and with no
 * booking or block at any moment of it. They come back as they were given, in the same order.
 *
 * Whether the restaurant is open then is generateSlots' question, so the booking's times should
 * be one of its slots.
 */
export function findFreeTables<Table extends SeatedTable>(
  tables: readonly Table[],
  booking: WantedBooking,
  taken: TakenTimes,
): Table[] {
  return tables.filter((table) => tableProblem(table, booking, taken) === null);
}
