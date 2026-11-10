// The rules for a week of opening hours (src/modules/opening-hours/opening-hours.rules.ts): which
// openings overlap, how many a day, and how an opening reads in a message.
import { describe, expect, test } from "vitest";

import {
  describeOpening,
  extraOpenings,
  findOverlaps,
} from "../src/modules/opening-hours/opening-hours.rules.ts";
import type { Opening } from "../src/modules/opening-hours/opening-hours.rules.ts";

// Days: 0 = Sunday … 6 = Saturday. Times: minutes after that day's midnight, 1560 = 02:00 next day.
const SUNDAY = 0;
const MONDAY = 1;
const FRIDAY = 5;
const SATURDAY = 6;

/** An opening written as clock times. "02:00" after "18:00" means the next morning. */
function opening(dayOfWeek: number, opens: string, closes: string): Opening {
  const minutes = (time: string): number => {
    const [hours = 0, mins = 0] = time.split(":").map(Number);
    return hours * 60 + mins;
  };
  const opensAt = minutes(opens);
  let closesAt = minutes(closes);
  if (closesAt <= opensAt) closesAt += 24 * 60;
  return { dayOfWeek, opensAt, closesAt };
}

describe("findOverlaps", () => {
  test("a week with split shifts and a late Friday has no overlaps", () => {
    // Like Lori Smokehouse: lunch and dinner on weekdays, and late on Friday.
    const week = [
      opening(MONDAY, "12:00", "15:00"),
      opening(MONDAY, "18:00", "23:00"),
      opening(FRIDAY, "18:00", "02:00"),
      opening(SATURDAY, "12:00", "23:00"),
    ];

    expect(findOverlaps(week)).toEqual([]);
  });

  test("two openings on the same day overlap, whatever order they're sent in", () => {
    const lunch = opening(MONDAY, "12:00", "15:00");
    const afternoon = opening(MONDAY, "14:00", "18:00");

    expect(findOverlaps([lunch, afternoon])).toEqual([{ index: 1, other: 0 }]);
    // The later opening is always the one that overlaps the earlier.
    expect(findOverlaps([afternoon, lunch])).toEqual([{ index: 0, other: 1 }]);
  });

  test("openings that only touch don't overlap", () => {
    const week = [opening(MONDAY, "12:00", "15:00"), opening(MONDAY, "15:00", "23:00")];

    expect(findOverlaps(week)).toEqual([]);
  });

  test("a late night runs into the next morning", () => {
    const friday = opening(FRIDAY, "18:00", "02:00");

    expect(findOverlaps([friday, opening(SATURDAY, "01:00", "04:00")])).toEqual([
      { index: 1, other: 0 },
    ]);
    // Saturday opening at 02:00 only touches Friday's closing.
    expect(findOverlaps([friday, opening(SATURDAY, "02:00", "04:00")])).toEqual([]);
  });

  test("Saturday's late night runs into Sunday, across the end of the week", () => {
    const saturday = opening(SATURDAY, "22:00", "03:00");

    expect(findOverlaps([opening(SUNDAY, "01:00", "05:00"), saturday])).toEqual([
      { index: 0, other: 1 },
    ]);
    expect(findOverlaps([opening(SUNDAY, "03:00", "05:00"), saturday])).toEqual([]);
  });

  test("two openings that start together overlap, and the later in the list is named", () => {
    const week = [opening(MONDAY, "18:00", "22:00"), opening(MONDAY, "18:00", "23:00")];

    expect(findOverlaps(week)).toEqual([{ index: 1, other: 0 }]);
  });

  test("each overlapping pair is reported once, even when both run past Saturday night", () => {
    const week = [opening(SATURDAY, "20:00", "03:00"), opening(SATURDAY, "21:00", "04:00")];

    expect(findOverlaps(week)).toEqual([{ index: 1, other: 0 }]);
  });

  test("one long opening can overlap several others", () => {
    const week = [
      opening(MONDAY, "10:00", "23:00"),
      opening(MONDAY, "12:00", "15:00"),
      opening(MONDAY, "18:00", "22:00"),
    ];

    expect(findOverlaps(week)).toEqual([
      { index: 1, other: 0 },
      { index: 2, other: 0 },
    ]);
  });

  test("a day open around the clock only touches the next day's first opening", () => {
    const week = [{ dayOfWeek: MONDAY, opensAt: 0, closesAt: 1440 }, opening(2, "00:00", "10:00")];

    expect(findOverlaps(week)).toEqual([]);
  });
});

describe("extraOpenings", () => {
  test("up to three openings a day, and the fourth is extra", () => {
    const week = [
      opening(MONDAY, "08:00", "10:00"),
      opening(MONDAY, "12:00", "15:00"),
      opening(FRIDAY, "18:00", "02:00"),
      opening(MONDAY, "18:00", "22:00"),
      opening(MONDAY, "22:30", "23:30"),
    ];

    expect(extraOpenings(week)).toEqual([4]);
    expect(extraOpenings(week.slice(0, 4))).toEqual([]);
  });
});

describe("describeOpening", () => {
  test("names the day and the clock times, past midnight included", () => {
    expect(describeOpening(opening(FRIDAY, "18:00", "02:00"))).toBe("Friday 18:00–02:00");
    expect(describeOpening(opening(SUNDAY, "12:15", "15:45"))).toBe("Sunday 12:15–15:45");
  });
});
