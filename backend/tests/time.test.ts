import { describe, expect, test } from "vitest";

import {
  addDays,
  dayOfWeek,
  localClockTime,
  localDate,
  localDayRange,
  localTimeToUtc,
  minutesToTime,
} from "../src/lib/time.ts";

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

describe("localDayRange", () => {
  test("a Yerevan day runs from 20:00 UTC the evening before to 20:00 UTC", () => {
    const { start, end } = localDayRange("2026-11-14", "Asia/Yerevan");

    expect(start.toISOString()).toBe("2026-11-13T20:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-14T20:00:00.000Z");
  });

  test("a day when the clocks change is 23 or 25 hours long, not 24", () => {
    const hours = (date: string): number => {
      const { start, end } = localDayRange(date, "America/New_York");
      return (end.getTime() - start.getTime()) / 3_600_000;
    };

    expect(hours("2026-03-08")).toBe(23);
    expect(hours("2026-11-01")).toBe(25);
    expect(hours("2026-07-01")).toBe(24);
  });
});

describe("localClockTime", () => {
  test("shows a moment on the restaurant's clock", () => {
    expect(localClockTime(new Date("2026-11-13T14:00:00.000Z"), "Asia/Yerevan")).toBe("18:00");
    // After midnight: the next morning's clock time.
    expect(localClockTime(new Date("2026-11-13T21:30:00.000Z"), "Asia/Yerevan")).toBe("01:30");
  });

  test("follows the clocks when they change, so nothing assumes a fixed offset", () => {
    expect(localClockTime(new Date("2026-07-01T16:00:00.000Z"), "America/New_York")).toBe("12:00");
    expect(localClockTime(new Date("2026-12-01T17:00:00.000Z"), "America/New_York")).toBe("12:00");
  });
});
