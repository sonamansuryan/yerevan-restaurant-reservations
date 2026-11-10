// The rules for a restaurant's week of opening hours that need no database. They're plain
// functions, so they're tested on their own.
import { MINUTES_PER_DAY, minutesToTime } from "../../lib/time.ts";

const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

/** Breakfast, lunch and dinner. */
export const OPENINGS_PER_DAY = 3;

/**
 * One opening: a day (0 = Sunday … 6 = Saturday) and its times, in minutes after that day's
 * midnight. A closing after midnight counts on from the same day, so Friday 18:00 to 02:00 is
 * day 5, 1080 to 1560, and it still belongs to Friday.
 */
export interface Opening {
  dayOfWeek: number;
  opensAt: number;
  closesAt: number;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** An opening as people read it: "Friday 18:00–02:00". */
export function describeOpening({ dayOfWeek, opensAt, closesAt }: Opening): string {
  return `${DAYS[dayOfWeek] ?? "Day"} ${minutesToTime(opensAt)}–${minutesToTime(closesAt)}`;
}

/** Two openings that are open at the same moment. `index` is the later one, `other` the earlier. */
export interface Overlap {
  index: number;
  other: number;
}

interface Span {
  index: number;
  start: number;
  end: number;
}

/**
 * Every pair of openings that are open at the same moment, by their places in the list.
 *
 * Each opening becomes a span of minutes on the week, counted from Sunday 00:00: Friday 18:00 is
 * 5 × 1440 + 1080. So Friday 18:00–02:00 runs into Saturday, where it meets any early Saturday
 * opening. Saturday's late hours run past the end of the week, so they're also placed a week
 * earlier, where they meet Sunday's first hours. Openings that only touch, such as lunch until
 * 15:00 and an opening from 15:00, don't overlap.
 */
export function findOverlaps(openings: readonly Opening[]): Overlap[] {
  const spans: Span[] = openings.flatMap((opening, index) => {
    const dayStart = opening.dayOfWeek * MINUTES_PER_DAY;
    const span = { index, start: dayStart + opening.opensAt, end: dayStart + opening.closesAt };
    if (span.end <= MINUTES_PER_WEEK) return [span];
    return [
      span,
      { index, start: span.start - MINUTES_PER_WEEK, end: span.end - MINUTES_PER_WEEK },
    ];
  });

  const overlaps: Overlap[] = [];
  const found = new Set<string>();
  for (const [position, first] of spans.entries()) {
    for (const second of spans.slice(position + 1)) {
      if (first.index === second.index) continue;
      if (first.start >= second.end || second.start >= first.end) continue;
      // The opening that starts later is the one that overlaps. On a tie, the later in the list.
      const [earlier, later] =
        first.start < second.start || (first.start === second.start && first.index < second.index)
          ? [first, second]
          : [second, first];
      // A pair can meet twice when both wrap past Saturday night, but it's reported once.
      const key = `${later.index}:${earlier.index}`;
      if (found.has(key)) continue;
      found.add(key);
      overlaps.push({ index: later.index, other: earlier.index });
    }
  }
  return overlaps;
}

/** The places in the list of openings beyond the third on their day. */
export function extraOpenings(openings: readonly Opening[]): number[] {
  const perDay = new Map<number, number>();
  return openings.flatMap(({ dayOfWeek }, index) => {
    const count = (perDay.get(dayOfWeek) ?? 0) + 1;
    perDay.set(dayOfWeek, count);
    return count > OPENINGS_PER_DAY ? [index] : [];
  });
}
