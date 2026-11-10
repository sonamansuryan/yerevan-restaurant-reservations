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
