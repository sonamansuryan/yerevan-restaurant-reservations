import { TZDate } from "@date-fns/tz";

export const MINUTES_PER_DAY = 1440;

/**
 * Seghan's restaurants are all in Yerevan, so a day across all of them, as the admin counts it, is
 * a Yerevan day. Anything about one restaurant uses that restaurant's own `timezone` instead.
 */
export const SEGHAN_TIME_ZONE = "Asia/Yerevan";

// Calendar dates are split by hand because new Date("2026-11-20") means midnight UTC, which can
// be a different day in the restaurant's time zone.
function parseDate(date: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Expected a YYYY-MM-DD date, got "${date}"`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** Today's calendar date in a time zone, as YYYY-MM-DD. */
export function localDate(now: Date, timeZone: string): string {
  const local = new TZDate(now.getTime(), timeZone);
  const month = String(local.getMonth() + 1).padStart(2, "0");
  const day = String(local.getDate()).padStart(2, "0");
  return `${local.getFullYear()}-${month}-${day}`;
}

/** Moves a YYYY-MM-DD date by whole days. This is calendar math, so no time zone is involved. */
export function addDays(date: string, days: number): string {
  const { year, month, day } = parseDate(date);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** The weekday of a YYYY-MM-DD date: 0 = Sunday … 6 = Saturday, the same as OpeningHour. */
export function dayOfWeek(date: string): number {
  const { year, month, day } = parseDate(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/**
 * The exact moment a restaurant-local time happens. `minutes` counts from midnight of the service
 * day, so 1470 on a Friday means 00:30 on Saturday.
 */
export function localTimeToUtc(date: string, minutes: number, timeZone: string): Date {
  const { year, month, day } = parseDate(date);
  // Roll onto the next date first. Adding 24 hours to an instant would land on the wrong wall
  // clock time on a day when the clocks change.
  const dayOffset = Math.floor(minutes / MINUTES_PER_DAY);
  const minuteOfDay = minutes % MINUTES_PER_DAY;
  const hour = Math.floor(minuteOfDay / 60);
  const local = new TZDate(year, month - 1, day + dayOffset, hour, minuteOfDay % 60, 0, timeZone);
  return new Date(local.getTime());
}

/**
 * The two moments a restaurant's calendar day starts and ends: its local midnight, and the next.
 * Usually 24 hours apart, but 23 or 25 on a day when the clocks change.
 */
export function localDayRange(date: string, timeZone: string): { start: Date; end: Date } {
  return {
    start: localTimeToUtc(date, 0, timeZone),
    end: localTimeToUtc(addDays(date, 1), 0, timeZone),
  };
}

/** A moment as a restaurant-local clock time to show, such as "19:30". */
export function localClockTime(moment: Date, timeZone: string): string {
  const local = new TZDate(moment.getTime(), timeZone);
  const hour = String(local.getHours()).padStart(2, "0");
  return `${hour}:${String(local.getMinutes()).padStart(2, "0")}`;
}

/**
 * A number of minutes after the service day's midnight, as a clock time to show. Closing times
 * can pass midnight, so 1560 is "02:00", the next morning.
 */
export function minutesToTime(minutes: number): string {
  const minuteOfDay = minutes % MINUTES_PER_DAY;
  const hour = String(Math.floor(minuteOfDay / 60)).padStart(2, "0");
  return `${hour}:${String(minuteOfDay % 60).padStart(2, "0")}`;
}
