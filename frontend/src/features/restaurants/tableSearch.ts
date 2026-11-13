// The search for a table that needs no server: the day, the time and the party it's for, as the
// home page's search and Browse ask for them, and the free times to show on each restaurant's card.
import type { To } from "react-router";

import { choicesParams, GUEST_COUNTS } from "@/features/booking/booking";
import { formatDayHeading, isCalendarDate, shiftDate } from "@/lib/time";
import type { Availability } from "@/types/api";

/** A table to look for: the day, about when, and for how many. */
export interface TableQuery {
  date: string;
  time: string;
  guests: number;
}

/** How far ahead the search looks: as far as booking can, today and the 60 days after it. */
export const SEARCH_DAYS = 61;

/** The time the search starts at, as the export has it: an evening table. */
export const USUAL_TIME = "19:30";

/** How many of its free times a card shows, so they fit on one line. */
export const CARD_TIMES = 3;

const minutes = (time: string): number => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const clockOf = (total: number): string =>
  `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;

/** The times to choose: every half hour from 09:00 to 23:30. */
export const SEARCH_TIMES: string[] = Array.from({ length: 30 }, (_, index) =>
  clockOf(9 * 60 + index * 30),
);

/** The days to choose, from today, as YYYY-MM-DD. */
export function searchDays(today: string): string[] {
  return Array.from({ length: SEARCH_DAYS }, (_, index) => shiftDate(today, index));
}

/**
 * The time a search starts at when none is chosen: 19:30, or once that's less than an hour away,
 * the first half hour that's at least an hour away, as the API offers nothing sooner. Late at
 * night, when that would be tomorrow, it stays 19:30.
 */
export function defaultTime(now: string): string {
  const soonest = Math.ceil((minutes(now) + 60) / 30) * 30;
  if (soonest <= minutes(USUAL_TIME) || soonest > minutes("23:30")) return USUAL_TIME;
  return clockOf(soonest);
}

/** The party from the address, when it's one Seghan books: 1 to 20. */
export function readGuests(value: string | null): number | undefined {
  const guests = Number(value);
  return value !== null && GUEST_COUNTS.includes(guests) ? guests : undefined;
}

/** The time from the address, when it's one of the search's half hours. */
export function readTime(value: string | null): string | undefined {
  return value !== null && SEARCH_TIMES.includes(value) ? value : undefined;
}

/** The day from the address, when it's a real date. Whether it can be booked is decided later. */
export function readDate(value: string | null): string | undefined {
  return value !== null && isCalendarDate(value) ? value : undefined;
}

/**
 * The search, filled in: what was chosen, and for anything missing, or a day that can't be booked
 * any more, today at the usual time for two.
 */
export function tableQuery(chosen: Partial<TableQuery>, today: string, now: string): TableQuery {
  const last = shiftDate(today, SEARCH_DAYS - 1);
  const date = chosen.date && chosen.date >= today && chosen.date <= last ? chosen.date : today;
  return {
    date,
    // Only today's search waits for the clock: any later day starts at the usual time.
    time: chosen.time ?? (date === today ? defaultTime(now) : USUAL_TIME),
    guests: chosen.guests ?? 2,
  };
}

/**
 * The free times nearest the time asked for, in the order of the day, so a card offers what's
 * closest to the guest's plan. A time with no table for the party isn't free. The API has already
 * left out the times that are past or less than an hour away.
 */
export function nearestFreeTimes(
  availability: Availability,
  time: string,
  count: number = CARD_TIMES,
): string[] {
  const wanted = minutes(time);
  return availability.slots
    .filter(({ tables }) => tables.length > 0)
    .map(({ starts }) => starts)
    .sort(
      (a, b) => Math.abs(minutes(a) - wanted) - Math.abs(minutes(b) - wanted) || a.localeCompare(b),
    )
    .slice(0, count)
    .sort((a, b) => a.localeCompare(b));
}

/** The restaurant's page with the booking already at this time, for this party, on this day. */
export function freeTimeLink(slug: string, query: TableQuery, time: string): To {
  const choices = choicesParams({ date: query.date, guests: query.guests, time, tableId: null });
  return { pathname: `/restaurants/${slug}`, search: `?${choices.toString()}` };
}

/** The restaurant's page with the booking on this day, for this party, to choose a time there. */
export function dayLink(slug: string, query: TableQuery): To {
  const choices = choicesParams({
    date: query.date,
    guests: query.guests,
    time: null,
    tableId: null,
  });
  return { pathname: `/restaurants/${slug}`, search: `?${choices.toString()}` };
}

/** When the times are, in words for a card: "today", or "on Saturday 14 November". */
export function whenWords(date: string, today: string): string {
  return date === today ? "today" : `on ${formatDayHeading(date, today)}`;
}

/** The search as sent: the words, and the table looked for. Anything unreadable is left out. */
export function readSearch(form: HTMLFormElement): {
  q: string | undefined;
  date: string | undefined;
  time: string | undefined;
  guests: number | undefined;
} {
  const data = new FormData(form);
  const text = (name: string): string | undefined => {
    const value = data.get(name);
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  };
  const guests = Number(text("guests"));
  return {
    q: text("q")?.slice(0, 100),
    date: text("date"),
    time: text("time"),
    guests: Number.isInteger(guests) && guests > 0 ? guests : undefined,
  };
}
