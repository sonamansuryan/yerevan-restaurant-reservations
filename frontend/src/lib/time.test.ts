import { expect, test } from "vitest";

import {
  formatBookDate,
  formatDayHeading,
  formatDayRange,
  formatMonth,
  isCalendarDate,
  shiftDate,
  yerevanToday,
  yerevanWeekday,
} from "@/lib/time";

test("a review is dated by its month and year, without any time zone math", () => {
  expect(formatMonth("2026-11-14")).toBe("November 2026");
  // The first and last days stay in their month, whatever the visitor's own time zone.
  expect(formatMonth("2026-01-01")).toBe("January 2026");
  expect(formatMonth("2025-12-31")).toBe("December 2025");
});

test("a day reads like a page of the book", () => {
  expect(formatBookDate(new Date("2026-11-06T12:00:00Z"))).toBe("Friday 6 November");
});

test("it's the date in Yerevan, which is already tomorrow late in the UTC evening", () => {
  // 21:30 UTC is 01:30 the next morning in Yerevan.
  expect(formatBookDate(new Date("2026-11-06T21:30:00Z"))).toBe("Saturday 7 November");
});

test("the weekday is Yerevan's, numbered as the API numbers it", () => {
  expect(yerevanWeekday(new Date("2026-11-06T12:00:00Z"))).toBe(5);
  // Late on a Friday in UTC, it's already Saturday morning in Yerevan.
  expect(yerevanWeekday(new Date("2026-11-06T21:30:00Z"))).toBe(6);
  expect(yerevanWeekday(new Date("2026-11-08T09:00:00Z"))).toBe(0);
});

test("today is Yerevan's date, which is already tomorrow late in the UTC evening", () => {
  expect(yerevanToday(new Date("2026-11-10T12:00:00Z"))).toBe("2026-11-10");
  expect(yerevanToday(new Date("2026-11-10T21:30:00Z"))).toBe("2026-11-11");
});

test("a date moves by whole days, across months and years", () => {
  expect(shiftDate("2026-11-13", 1)).toBe("2026-11-14");
  expect(shiftDate("2026-11-30", 1)).toBe("2026-12-01");
  expect(shiftDate("2027-01-01", -1)).toBe("2026-12-31");
});

test("only a real date counts as one", () => {
  expect(isCalendarDate("2026-11-13")).toBe(true);
  expect(isCalendarDate("2028-02-29")).toBe(true);
  expect(isCalendarDate("2026-02-29")).toBe(false);
  expect(isCalendarDate("2026-13-01")).toBe(false);
  expect(isCalendarDate("13/11/2026")).toBe(false);
  expect(isCalendarDate("tomorrow")).toBe(false);
});

test("a page of the book is headed with the day, and the year only when it's another year", () => {
  expect(formatDayHeading("2026-11-13", "2026-11-10")).toBe("Friday 13 November");
  expect(formatDayHeading("2027-01-05", "2026-11-10")).toBe("Tuesday 5 January 2027");
});

test("a run of days names its first and last, with years only when they differ", () => {
  expect(formatDayRange("2026-10-14", "2026-11-12")).toBe("14 October – 12 November");
  expect(formatDayRange("2026-11-06", "2026-11-12")).toBe("6 November – 12 November");
  expect(formatDayRange("2026-12-17", "2027-01-14")).toBe("17 December 2026 – 14 January 2027");
});
