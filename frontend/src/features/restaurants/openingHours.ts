import type { OpeningHours } from "@/types/api";

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// Calendars in Armenia start the week on Monday. The API numbers days from Sunday, 0, so Sunday
// moves to the end.
export const WEEK = [1, 2, 3, 4, 5, 6, 0];

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

/** Whether a restaurant is open at a moment: open until a time, opening later today, or closed. */
export type OpenState =
  { kind: "open"; until: string } | { kind: "later"; opens: string } | { kind: "closed" };

const MINUTES_IN_DAY = 24 * 60;

/**
 * Whether the restaurant is open now, as its page says beside its name: "Open now · until 23:30".
 * The week's hours are in minutes after each day's midnight, and a closing past midnight is above
 * 1440, so last night's late shift still counts in the small hours. `weekday` is Yerevan's, 0 =
 * Sunday, and `clock` its time, HH:MM.
 */
export function openState(hours: OpeningHours[], weekday: number, clock: string): OpenState {
  const now = Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));
  const yesterday = (weekday + 6) % 7;
  const open =
    hours.find(
      (shift) => shift.dayOfWeek === weekday && shift.opensAt <= now && now < shift.closesAt,
    ) ??
    hours.find((shift) => shift.dayOfWeek === yesterday && now + MINUTES_IN_DAY < shift.closesAt);
  if (open) return { kind: "open", until: open.closes };
  const next = hours
    .filter((shift) => shift.dayOfWeek === weekday && shift.opensAt > now)
    .sort((a, b) => a.opensAt - b.opensAt)[0];
  return next ? { kind: "later", opens: next.opens } : { kind: "closed" };
}

/** The open state in words: "Open now · until 23:30", "Opens at 18:00" or "Closed now". */
export function openWords(state: OpenState): string {
  if (state.kind === "open") {
    return `Open now · until ${state.until === "00:00" ? "midnight" : state.until}`;
  }
  return state.kind === "later" ? `Opens at ${state.opens}` : "Closed now";
}
