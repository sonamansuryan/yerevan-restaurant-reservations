import { z } from "zod";

import { fieldMessages } from "@/features/auth/serverErrors";
import type { ApiError } from "@/lib/api";
import type { OpeningHours } from "@/types/api";

const MINUTES_PER_DAY = 24 * 60;

/** Breakfast, lunch and dinner: the server refuses a fourth opening on one day. */
export const OPENINGS_PER_DAY = 3;

/** Every quarter hour of a day, 00:00 to 23:45, as minutes after midnight. */
export const QUARTER_HOURS = Array.from({ length: 96 }, (_, quarter) => quarter * 15);

/** One opening, as the week is sent: a day (0 = Sunday) and minutes after its midnight. */
export interface Opening {
  dayOfWeek: number;
  opensAt: number;
  closesAt: number;
}

/**
 * One opening as the form holds it: two clock times, as text, the way a select holds them. A
 * closing at or before the opening time is the next day's, as in "18:00 to 02:00". So any two
 * times make a real opening, and the form never has to refuse "closes before it opens".
 */
export interface OpeningFields {
  dayOfWeek: number;
  opens: string;
  closes: string;
}

/** 1080 is "18:00", and 1560, past midnight, is "02:00". */
export function clockTime(minutes: number): string {
  const inDay = minutes % MINUTES_PER_DAY;
  const hours = String(Math.floor(inDay / 60)).padStart(2, "0");
  return `${hours}:${String(inDay % 60).padStart(2, "0")}`;
}

/** Whether a closing time belongs to the next day: at or before the opening time. */
export function closesNextDay(opens: number, closes: number): boolean {
  return closes <= opens;
}

/** A saved opening, as the form shows it: 18:00 to 1560 becomes 18:00 to 02:00, the next day. */
export function openingFields({ dayOfWeek, opensAt, closesAt }: OpeningHours): OpeningFields {
  return { dayOfWeek, opens: String(opensAt), closes: String(closesAt % MINUTES_PER_DAY) };
}

/** An opening as it's sent. A closing on the next day counts on from this day: 02:00 is 1560. */
export function openingFromFields({ dayOfWeek, opens, closes }: OpeningFields): Opening {
  const opensAt = Number(opens);
  const clock = Number(closes);
  return {
    dayOfWeek,
    opensAt,
    closesAt: closesNextDay(opensAt, clock) ? clock + MINUTES_PER_DAY : clock,
  };
}

/**
 * A new opening: lunch to late evening on an empty day, or an evening beside an existing one. The
 * owner then picks the real times.
 */
export function newOpening(dayOfWeek: number, isFirst: boolean): OpeningFields {
  return isFirst
    ? { dayOfWeek, opens: String(12 * 60), closes: String(22 * 60) }
    : { dayOfWeek, opens: String(18 * 60), closes: String(23 * 60) };
}

export const weekFormSchema = z.object({
  hours: z
    .array(z.object({ dayOfWeek: z.number(), opens: z.string(), closes: z.string() }))
    // The server's words for an empty week: closing for a while is what unpublishing is for.
    .min(1, "Add at least one opening time.")
    .transform((hours) => hours.map(openingFromFields)),
});

/** What the form holds. */
export type WeekFields = z.input<typeof weekFormSchema>;
/** What's sent: the openings in the form's order, so the server's messages find their rows. */
export type WeekRequest = z.output<typeof weekFormSchema>;

/** A saved week, as the form shows it. */
export function weekFields(week: OpeningHours[]): WeekFields {
  return { hours: week.map(openingFields) };
}

/**
 * The server's messages about single openings, by their place in the list that was sent:
 * `hours.3` is "Overlaps Monday 12:00–15:00." for the fourth. The first message for each wins.
 */
export function openingMessages(error: ApiError | null): Map<number, string> {
  const messages = new Map<number, string>();
  for (const [path, message] of Object.entries(fieldMessages(error))) {
    const match = /^hours\.(\d+)(\.|$)/.exec(path);
    if (!match) continue;
    const index = Number(match[1]);
    if (!messages.has(index)) messages.set(index, message);
  }
  return messages;
}

/** The server's message about the week as a whole, such as an empty week. */
export function weekMessage(error: ApiError | null): string | undefined {
  return fieldMessages(error).hours;
}
