// The booking widget's rules that need no server: the choices kept in the address, the day's times
// in courses, the row of days, the best table, and the words on the booking's button.
import type { ReturnState } from "@/features/auth/returnTo";
import { daysFrom, formatWeekdayDate, isCalendarDate, shiftDate } from "@/lib/time";
import type { AvailableTable, AvailabilitySlot } from "@/types/api";

/** What the guest has chosen. The address keeps it, so a reload or a shared link brings it back. */
export interface BookingChoices {
  date: string;
  guests: number;
  time: string | null;
  tableId: string | null;
}

/** Who's booking, which decides what the last step offers. */
export type Viewer =
  | { kind: "checking" }
  | { kind: "signedOut"; signIn: ReturnState }
  | { kind: "guest"; name: string }
  | { kind: "notAGuest"; name: string };

/** One to twenty guests. A bigger group calls the restaurant. */
export const GUEST_COUNTS = Array.from({ length: 20 }, (_, index) => index + 1);

/** The choices in the address. Anything missing or malformed falls back to today, for two. */
export function choicesFrom(params: URLSearchParams, today: string): BookingChoices {
  const date = params.get("date") ?? "";
  const guests = Number(params.get("guests"));
  const time = params.get("time") ?? "";
  return {
    date: isCalendarDate(date) ? date : today,
    guests: GUEST_COUNTS.includes(guests) ? guests : 2,
    time: /^\d{2}:\d{2}$/.test(time) ? time : null,
    tableId: params.get("table") || null,
  };
}

/** The choices as the address writes them. A table only counts with its time. */
export function choicesParams({ date, guests, time, tableId }: BookingChoices): URLSearchParams {
  const params = new URLSearchParams({ date, guests: String(guests) });
  if (time) params.set("time", time);
  if (time && tableId) params.set("table", tableId);
  return params;
}

export interface Course {
  /** "Lunch" or "Dinner", when the day has more than one. */
  name: string | null;
  slots: AvailabilitySlot[];
}

// Times in one service are 15 or 30 minutes apart, so a longer gap means the kitchen closes in
// between, as it does between lunch and dinner.
const BREAK_MS = 60 * 60_000;

/** The day's times in courses, like a menu, instead of one long run. */
export function coursesOf(slots: AvailabilitySlot[]): Course[] {
  const runs: AvailabilitySlot[][] = [];
  let previous: number | null = null;
  for (const slot of slots) {
    const startsAt = Date.parse(slot.startsAt);
    if (previous === null || startsAt - previous > BREAK_MS) runs.push([]);
    runs.at(-1)?.push(slot);
    previous = startsAt;
  }
  return runs.map((run) => ({
    name: runs.length > 1 ? courseName(run[0]?.starts ?? "") : null,
    slots: run,
  }));
}

function courseName(starts: string): string {
  if (starts < "11:00") return "Breakfast";
  return starts < "16:00" ? "Lunch" : "Dinner";
}

export const guestsLabel = (guests: number): string =>
  `${guests} ${guests === 1 ? "guest" : "guests"}`;

export const seatsLabel = (seats: number): string => `${seats} ${seats === 1 ? "seat" : "seats"}`;

/** The booking button's words, as the export has them: "Reserve for 2 · Fri 13 Nov, 19:30". */
export function reserveLabel(guests: number, date: string, time: string): string {
  return `Reserve for ${guests} · ${formatWeekdayDate(date)}, ${time}`;
}

/**
 * The table that fits the party best: the smallest of the free ones, so bigger tables stay free for
 * bigger parties. Of two the same size, the first by name. Null when none is free.
 */
export function bestFit(tables: AvailableTable[]): string | null {
  const [best] = [...tables].sort(
    (a, b) => a.capacity - b.capacity || a.label.localeCompare(b.label, "en", { numeric: true }),
  );
  return best?.id ?? null;
}

/** How many days the booking's row of dates shows at once, as the export has it. */
export const DAYS_SHOWN = 5;

/**
 * The first of the five days shown, for a date: the rows run on from today, five days at a time,
 * so a date always shows in the same row.
 */
export function rowStartFor(date: string, today: string): string {
  const offset = Math.max(0, daysFrom(today, date));
  return shiftDate(today, offset - (offset % DAYS_SHOWN));
}
