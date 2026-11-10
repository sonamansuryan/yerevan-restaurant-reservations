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
