import { describe, expect, test } from "vitest";

import { openState, openWords, weekRows } from "@/features/restaurants/openingHours";
import type { OpeningHours } from "@/types/api";

const shift = (dayOfWeek: number, opens: string, closes: string, opensAt = 0): OpeningHours => ({
  dayOfWeek,
  opensAt,
  closesAt: opensAt + 60,
  opens,
  closes,
});

test("the week starts on Monday and ends on Sunday", () => {
  expect(weekRows([]).map(({ day }) => day)).toEqual([
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ]);
  expect(weekRows([]).map(({ dayOfWeek }) => dayOfWeek)).toEqual([1, 2, 3, 4, 5, 6, 0]);
});

test("a day without hours has no shifts, which shows as closed", () => {
  const rows = weekRows([shift(2, "18:00", "23:00")]);

  expect(rows.find(({ day }) => day === "Monday")?.shifts).toEqual([]);
  expect(rows.find(({ day }) => day === "Tuesday")?.shifts).toEqual([
    { opens: "18:00", closes: "23:00" },
  ]);
});

test("split shifts come earliest first, whatever order the API sends them in", () => {
  const rows = weekRows([shift(1, "18:00", "23:00", 1080), shift(1, "12:00", "15:00", 720)]);

  expect(rows[0]?.shifts).toEqual([
    { opens: "12:00", closes: "15:00" },
    { opens: "18:00", closes: "23:00" },
  ]);
});

test("a late night keeps the API's ready-made closing time", () => {
  const rows = weekRows([shift(5, "18:00", "02:00", 1080)]);

  expect(rows.find(({ day }) => day === "Friday")?.shifts).toEqual([
    { opens: "18:00", closes: "02:00" },
  ]);
});

describe("whether a restaurant is open now", () => {
  const FRIDAY = 5;
  const SATURDAY = 6;
  const SUNDAY = 0;

  /** A shift as the API sends it: minutes after the day's midnight, and the times to show. */
  const opening = (
    dayOfWeek: number,
    [opensAt, opens]: [number, string],
    [closesAt, closes]: [number, string],
  ): OpeningHours => ({ dayOfWeek, opensAt, closesAt, opens, closes });

  const lunch = opening(FRIDAY, [720, "12:00"], [900, "15:00"]);
  const dinner = opening(FRIDAY, [1080, "18:00"], [1380, "23:00"]);
  // Friday 18:00 to 02:00 on Saturday morning: a closing past midnight is above 1440.
  const lateFriday = opening(FRIDAY, [1080, "18:00"], [1560, "02:00"]);

  test("within a shift, it's open until the shift's closing time", () => {
    expect(openState([dinner], FRIDAY, "19:00")).toEqual({ kind: "open", until: "23:00" });
    // It opens on the minute it opens, and is still open the minute before it closes.
    expect(openState([dinner], FRIDAY, "18:00")).toEqual({ kind: "open", until: "23:00" });
    expect(openState([dinner], FRIDAY, "22:59")).toEqual({ kind: "open", until: "23:00" });
  });

  test("a late shift is open before midnight, until its closing the next morning", () => {
    expect(openState([lateFriday], FRIDAY, "23:30")).toEqual({ kind: "open", until: "02:00" });
  });

  test("in the small hours, last night's late shift is still open", () => {
    expect(openState([lateFriday], SATURDAY, "01:00")).toEqual({ kind: "open", until: "02:00" });
    // Saturday night's late shift is still open early on Sunday, the start of the API's week.
    const lateSaturday = opening(SATURDAY, [1080, "18:00"], [1560, "02:00"]);
    expect(openState([lateSaturday], SUNDAY, "01:59")).toEqual({ kind: "open", until: "02:00" });
  });

  test("last night's late shift is over at its closing time", () => {
    expect(openState([lateFriday], SATURDAY, "02:00")).toEqual({ kind: "closed" });
    // A shift that closes at midnight is over at 00:00.
    const toMidnight = opening(FRIDAY, [1080, "18:00"], [1440, "00:00"]);
    expect(openState([toMidnight], FRIDAY, "23:59")).toEqual({ kind: "open", until: "00:00" });
    expect(openState([toMidnight], SATURDAY, "00:00")).toEqual({ kind: "closed" });
  });

  test("before today's first shift, it opens later today", () => {
    expect(openState([dinner, lunch], FRIDAY, "09:00")).toEqual({ kind: "later", opens: "12:00" });
  });

  test("between split shifts, it opens again later", () => {
    expect(openState([dinner, lunch], FRIDAY, "13:00")).toEqual({ kind: "open", until: "15:00" });
    expect(openState([dinner, lunch], FRIDAY, "15:00")).toEqual({ kind: "later", opens: "18:00" });
    expect(openState([dinner, lunch], FRIDAY, "16:30")).toEqual({ kind: "later", opens: "18:00" });
  });

  test("in the small hours after last night's shift, it opens later today", () => {
    const saturdayLunch = opening(SATURDAY, [720, "12:00"], [900, "15:00"]);

    expect(openState([lateFriday, saturdayLunch], SATURDAY, "03:00")).toEqual({
      kind: "later",
      opens: "12:00",
    });
  });

  test("once the last shift has ended, it's closed", () => {
    expect(openState([lunch, dinner], FRIDAY, "23:00")).toEqual({ kind: "closed" });
    expect(openState([lunch, dinner], FRIDAY, "23:30")).toEqual({ kind: "closed" });
  });

  test("a day without hours is closed, whatever the other days do", () => {
    expect(openState([lunch, dinner], SATURDAY, "13:00")).toEqual({ kind: "closed" });
    expect(openState([], FRIDAY, "19:00")).toEqual({ kind: "closed" });
  });
});

test("the open state in words", () => {
  expect(openWords({ kind: "open", until: "23:30" })).toBe("Open now · until 23:30");
  expect(openWords({ kind: "open", until: "02:00" })).toBe("Open now · until 02:00");
  expect(openWords({ kind: "open", until: "00:00" })).toBe("Open now · until midnight");
  expect(openWords({ kind: "later", opens: "18:00" })).toBe("Opens at 18:00");
  expect(openWords({ kind: "closed" })).toBe("Closed now");
});
