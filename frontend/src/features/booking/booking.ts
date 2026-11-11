// The booking widget's rules that need no server: the choices kept in the address, the day's times
// in courses, and the booking said back before it's sent.
import type { ReturnState } from "@/features/auth/returnTo";
import { formatDayHeading, isCalendarDate } from "@/lib/time";
import type { AvailabilitySlot, TableZone } from "@/types/api";

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

const PARTIES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const PLACES: Record<TableZone, string> = {
  INDOOR: "indoors",
  TERRACE: "on the terrace",
  VIP: "in the VIP room",
  BAR_COUNTER: "at the bar",
};

/**
 * The booking said back before it's sent, as a host does on the phone: "A table for two on
 * Saturday 14 November at 19:00, indoors." It helps people catch a mistake.
 */
export function readBack(
  guests: number,
  date: string,
  time: string,
  zone: TableZone,
  today?: string,
): string {
  const party = PARTIES[guests] ?? String(guests);
  return `A table for ${party} on ${formatDayHeading(date, today)} at ${time}, ${PLACES[zone]}.`;
}

export const guestsLabel = (guests: number): string =>
  `${guests} ${guests === 1 ? "guest" : "guests"}`;

export const seatsLabel = (seats: number): string => `${seats} ${seats === 1 ? "seat" : "seats"}`;
