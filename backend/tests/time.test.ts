import { describe, expect, test } from "vitest";

import { addDays, dayOfWeek, localDate, localTimeToUtc, minutesToTime } from "../src/lib/time.ts";

describe("localTimeToUtc", () => {
  test("converts Yerevan time, as in PROJECT_PLAN.md §5.6", () => {
    const moment = localTimeToUtc("2026-11-20", 19 * 60, "Asia/Yerevan");

    expect(moment.toISOString()).toBe("2026-11-20T15:00:00.000Z");
  });

  test("rolls minutes past midnight onto the next date, as in §6.2", () => {
    expect(localTimeToUtc("2026-11-20", 1440, "Asia/Yerevan").toISOString()).toBe(
      "2026-11-20T20:00:00.000Z",
    );
    expect(localTimeToUtc("2026-11-20", 1470, "Asia/Yerevan").toISOString()).toBe(
      "2026-11-20T20:30:00.000Z",
    );
  });

  test("rolls across the end of a month and a year", () => {
    expect(localTimeToUtc("2026-11-30", 1470, "Asia/Yerevan").toISOString()).toBe(
      "2026-11-30T20:30:00.000Z",
    );
    expect(localTimeToUtc("2026-12-31", 1470, "Asia/Yerevan").toISOString()).toBe(
      "2026-12-31T20:30:00.000Z",
    );
  });

  test("works in a zone with daylight saving, so nothing assumes UTC+4", () => {
    expect(localTimeToUtc("2026-07-01", 720, "America/New_York").toISOString()).toBe(
      "2026-07-01T16:00:00.000Z",
    );
    expect(localTimeToUtc("2026-12-01", 720, "America/New_York").toISOString()).toBe(
      "2026-12-01T17:00:00.000Z",
    );
  });

  test("keeps the wall clock time across a clock change", () => {
    // 03:00 on the day the clocks go forward. Adding 24 hours would give 04:00.
    expect(localTimeToUtc("2026-03-07", 1620, "America/New_York").toISOString()).toBe(
      "2026-03-08T07:00:00.000Z",
    );
  });

  test("rejects a date in the wrong format", () => {
    expect(() => localTimeToUtc("20/11/2026", 720, "Asia/Yerevan")).toThrow("YYYY-MM-DD");
  });
});

describe("localDate", () => {
  test("uses the date in the restaurant's zone, not the UTC date", () => {
    expect(localDate(new Date("2026-11-20T19:59:00Z"), "Asia/Yerevan")).toBe("2026-11-20");
    expect(localDate(new Date("2026-11-20T20:00:00Z"), "Asia/Yerevan")).toBe("2026-11-21");
  });
});

describe("addDays", () => {
  test("moves forwards and backwards across months and years", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("dayOfWeek", () => {
  test("numbers days from Sunday, the same as OpeningHour", () => {
    expect(dayOfWeek("2026-11-22")).toBe(0); // a Sunday
    expect(dayOfWeek("2026-11-20")).toBe(5); // a Friday
  });
});

describe("minutesToTime", () => {
  test.each([
    [0, "00:00"],
    [540, "09:00"],
    [750, "12:30"],
    [1380, "23:00"],
    // Past midnight: the next morning, on the clock.
    [1440, "00:00"],
    [1470, "00:30"],
    [1560, "02:00"],
  ])("%i minutes is %s", (minutes, time) => {
    expect(minutesToTime(minutes)).toBe(time);
  });
});
