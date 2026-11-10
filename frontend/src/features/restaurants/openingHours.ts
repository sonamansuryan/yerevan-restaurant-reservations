import type { OpeningHours } from "@/types/api";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Calendars in Armenia start the week on Monday. The API numbers days from Sunday, 0, so Sunday
// moves to the end.
const WEEK = [1, 2, 3, 4, 5, 6, 0];

export interface DayHours {
  /** 0 = Sunday … 6 = Saturday, as the API counts. */
  dayOfWeek: number;
  day: string;
  /** Empty on a closed day. Two or more for split shifts, earliest first. */
  shifts: { opens: string; closes: string }[];
}

/** A restaurant's hours as the seven days of a week, Monday first, closed days included. */
export function weekRows(hours: OpeningHours[]): DayHours[] {
  return WEEK.map((dayOfWeek) => ({
    dayOfWeek,
    day: DAY_NAMES[dayOfWeek] ?? "",
    shifts: hours
      .filter((shift) => shift.dayOfWeek === dayOfWeek)
      .sort((a, b) => a.opensAt - b.opensAt)
      .map(({ opens, closes }) => ({ opens, closes })),
  }));
}
