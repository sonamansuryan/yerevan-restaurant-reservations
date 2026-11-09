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
