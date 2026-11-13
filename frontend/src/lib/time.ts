// Seghan's restaurants are all in Yerevan, so a date on screen is a Yerevan date, wherever the
// visitor happens to be. Intl does the time zone math, so no offset is written down here.
const bookDate = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Asia/Yerevan",
});

/** A day as the open book prints it, such as "Friday 6 November". */
export function formatBookDate(date: Date): string {
  return bookDate.format(date);
}

const weekdayName = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  timeZone: "Asia/Yerevan",
});
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The day of the week in Yerevan at that moment: 0 = Sunday … 6 = Saturday, as the API counts. */
export function yerevanWeekday(date: Date): number {
  return WEEKDAYS.indexOf(weekdayName.format(date));
}

// Canada writes dates the way the API sends them: 2026-11-13.
const isoDate = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Yerevan",
});

/** Today's date in Yerevan, as YYYY-MM-DD, the way dates travel to the API. */
export function yerevanToday(now: Date = new Date()): string {
  return isoDate.format(now);
}

const clock = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Yerevan",
});

/** The time in Yerevan at that moment, as HH:MM on a 24-hour clock, such as "19:05". */
export function yerevanClock(now: Date = new Date()): string {
  return clock.format(now);
}

/**
 * The year, month and day of a YYYY-MM-DD date, or null if it isn't one, or doesn't exist, such as
 * 2026-02-30. Split by hand, because new Date("2026-11-13") means midnight UTC.
 */
function dateParts(date: string): [number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  const exists =
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day;
  return exists ? [year, month, day] : null;
}

/** Whether text is a real YYYY-MM-DD date, such as one typed into an address. */
export function isCalendarDate(text: string): boolean {
  return dateParts(text) !== null;
}

/** A YYYY-MM-DD date moved by whole days. This is calendar math, so no time zone is involved. */
export function shiftDate(date: string, days: number): string {
  const [year, month, day] = dateParts(date) ?? [1970, 1, 1];
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

// The date is already the restaurant's own, so it's printed as it is, in UTC, with no zone math.
const dayHeading = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

const monthName = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** The month of a YYYY-MM-DD date, such as "November 2026": how a review is dated. */
export function formatMonth(date: string): string {
  const [year, month] = dateParts(date) ?? [1970, 1, 1];
  return monthName.format(new Date(Date.UTC(year, month - 1, 1)));
}

/**
 * A YYYY-MM-DD date as the heading of a page in the book: "Friday 13 November", with the year
 * when it isn't this year's.
 */
export function formatDayHeading(date: string, today: string = yerevanToday()): string {
  const [year, month, day] = dateParts(date) ?? [1970, 1, 1];
  const heading = dayHeading.format(new Date(Date.UTC(year, month - 1, day)));
  // Added by hand: with the year, Intl puts a comma after the weekday, unlike the book's style.
  return date.slice(0, 4) === today.slice(0, 4) ? heading : `${heading} ${year}`;
}

const shortDay = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const shortDayOfMonth = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/**
 * A YYYY-MM-DD date in a few letters, for a short list such as the search's dates: "Today, 13 Nov",
 * "Tomorrow, 14 Nov", then "Sun 15 Nov".
 */
export function formatShortDay(date: string, today: string = yerevanToday()): string {
  const [year, month, day] = dateParts(date) ?? [1970, 1, 1];
  const at = new Date(Date.UTC(year, month - 1, day));
  if (date === today) return `Today, ${shortDayOfMonth.format(at)}`;
  if (date === shiftDate(today, 1)) return `Tomorrow, ${shortDayOfMonth.format(at)}`;
  // en-GB writes "Sun 15 Nov", with no comma after the weekday.
  return shortDay.format(at);
}

/**
 * A YYYY-MM-DD date with its weekday, in a few letters: "Fri 13 Nov". Given today, a day in another
 * year gets its year too: "Wed 31 Dec 2025".
 */
export function formatWeekdayDate(date: string, today?: string): string {
  const [year, month, day] = dateParts(date) ?? [1970, 1, 1];
  const short = shortDay.format(new Date(Date.UTC(year, month - 1, day)));
  return today !== undefined && date.slice(0, 4) !== today.slice(0, 4) ? `${short} ${year}` : short;
}

/** Whole days from one YYYY-MM-DD date to another: 1 from today to tomorrow, -1 back. */
export function daysFrom(from: string, to: string): number {
  const [fromYear, fromMonth, fromDay] = dateParts(from) ?? [1970, 1, 1];
  const [toYear, toMonth, toDay] = dateParts(to) ?? [1970, 1, 1];
  const ms = Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay);
  return Math.round(ms / 86_400_000);
}

const monthOnly = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" });

/** The month of a run of days, or both months when it crosses into the next: "November – December". */
export function formatMonthSpan(from: string, to: string): string {
  const name = (date: string): string => {
    const [year, month] = dateParts(date) ?? [1970, 1, 1];
    return monthOnly.format(new Date(Date.UTC(year, month - 1, 1)));
  };
  return from.slice(0, 7) === to.slice(0, 7) ? name(from) : `${name(from)} – ${name(to)}`;
}

const weekdayOfDate = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });

/** The day of the week of a YYYY-MM-DD date: 0 = Sunday … 6 = Saturday, as the API counts. */
export function weekdayOf(date: string): number {
  const [year, month, day] = dateParts(date) ?? [1970, 1, 1];
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** A YYYY-MM-DD date's weekday and day of the month, for a day to tap: { weekday: "Fri", day: 13 }. */
export function dayParts(date: string): { weekday: string; day: number } {
  const [year, month, day] = dateParts(date) ?? [1970, 1, 1];
  return { weekday: weekdayOfDate.format(new Date(Date.UTC(year, month - 1, day))), day };
}

const dayAndMonth = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

const dayMonthAndYear = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * The days from one YYYY-MM-DD date to another, as "14 October – 12 November": the days the
 * analytics count. Each gets its year only when the two are in different years.
 */
export function formatDayRange(from: string, to: string): string {
  const format = from.slice(0, 4) === to.slice(0, 4) ? dayAndMonth : dayMonthAndYear;
  const day = (date: string): string => {
    const [year, month, dayOfMonth] = dateParts(date) ?? [1970, 1, 1];
    return format.format(new Date(Date.UTC(year, month - 1, dayOfMonth)));
  };
  return `${day(from)} – ${day(to)}`;
}
