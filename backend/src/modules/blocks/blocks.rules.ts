// The rules for a block's time that need no database. They're plain functions, so they're tested on
// their own. Times are the restaurant's own: lib/time.ts turns them into exact moments.
import { localDayRange, localTimeToUtc } from "../../lib/time.ts";

/** The longest one block can last. Longer closures are blocked a year at a time. */
export const MAX_BLOCK_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A local date and time, "2026-11-20T18:00", as a date and minutes after its midnight, or null if
 * it isn't a real one on the quarter hour. Split by hand: new Date() would read it as UTC.
 */
export function parseLocalDateTime(text: string): { date: string; minutes: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(text);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  // A date that doesn't exist, such as 2026-02-30, moves on to another day in Date.UTC.
  const check = new Date(Date.UTC(year, month - 1, day));
  const realDate =
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day;
  if (!realDate || hour > 23 || minute > 59 || minute % 15 !== 0) return null;
  return { date: text.slice(0, 10), minutes: hour * 60 + minute };
}

/** What the owner asked for: a whole date, or a time range. Both are the restaurant's own time. */
export type BlockTime = { date: string } | { from: string; to: string };

/**
 * The exact moments a block starts and ends. A date is its whole calendar day, from one local
 * midnight to the next. A time range runs from one local date and time to another, so it can cross
 * midnight or last several days.
 */
export function blockRange(time: BlockTime, timeZone: string): { startsAt: Date; endsAt: Date } {
  if ("date" in time) {
    const { start, end } = localDayRange(time.date, timeZone);
    return { startsAt: start, endsAt: end };
  }
  const from = parseLocalDateTime(time.from);
  const to = parseLocalDateTime(time.to);
  // The schema has checked both, so this only guards against being called without it.
  if (!from || !to) throw new Error("A block's times must be checked before they're converted.");
  return {
    startsAt: localTimeToUtc(from.date, from.minutes, timeZone),
    endsAt: localTimeToUtc(to.date, to.minutes, timeZone),
  };
}

/**
 * What's wrong with a block's moments, if anything, as a message for the field that set its end:
 * an end that isn't after its start, a block that's already over, or one longer than a year. A
 * block may start in the past, such as "the rest of today".
 */
export function blockRangeProblem(
  range: { startsAt: Date; endsAt: Date },
  now: Date,
): string | null {
  if (range.endsAt <= range.startsAt) return "End the block after it starts.";
  if (range.endsAt <= now) return "Choose a time that hasn't passed yet.";
  if (range.endsAt.getTime() - range.startsAt.getTime() > MAX_BLOCK_DAYS * DAY_MS) {
    return "Block up to a year at a time.";
  }
  return null;
}

/** What the owner is told when bookings fall inside a block. */
export function blockRefusalMessage(bookings: number): string {
  return bookings === 1
    ? "An upcoming booking falls inside this block. Choose another time, or cancel that booking first."
    : `${bookings} upcoming bookings fall inside this block. Choose another time, or cancel them first.`;
}
