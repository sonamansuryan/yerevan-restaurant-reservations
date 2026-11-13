import { expect, test } from "vitest";

import {
  dayParts,
  daysFrom,
  formatBookDate,
  formatDayHeading,
  formatDayRange,
  formatMonth,
  formatMonthSpan,
  formatShortDay,
  formatWeekdayDate,
  isCalendarDate,
  shiftDate,
  weekdayOf,
  yerevanClock,
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

test("the time is Yerevan's, on a 24-hour clock", () => {
  // 15:45 UTC is 19:45 in Yerevan, 4 hours ahead.
  expect(yerevanClock(new Date("2026-11-13T15:45:00Z"))).toBe("19:45");
  expect(yerevanClock(new Date("2026-11-13T05:07:00Z"))).toBe("09:07");
  expect(yerevanClock(new Date("2026-11-13T19:59:00Z"))).toBe("23:59");
});

test("midnight in Yerevan is 00:00, not 24:00", () => {
  expect(yerevanClock(new Date("2026-11-13T20:00:00Z"))).toBe("00:00");
  expect(yerevanClock(new Date("2026-11-13T20:05:00Z"))).toBe("00:05");
});

test("a short day is today or tomorrow by name, and any other by its weekday", () => {
  expect(formatShortDay("2026-11-13", "2026-11-13")).toBe("Today, 13 Nov");
  expect(formatShortDay("2026-11-14", "2026-11-13")).toBe("Tomorrow, 14 Nov");
  expect(formatShortDay("2026-11-15", "2026-11-13")).toBe("Sun 15 Nov");
  // Tomorrow can be in the next month, or the next year.
  expect(formatShortDay("2026-12-01", "2026-11-30")).toBe("Tomorrow, 1 Dec");
  expect(formatShortDay("2027-01-01", "2026-12-31")).toBe("Tomorrow, 1 Jan");
});

test("a date with its weekday, in a few letters", () => {
  expect(formatWeekdayDate("2026-11-13")).toBe("Fri 13 Nov");
  expect(formatWeekdayDate("2027-01-01")).toBe("Fri 1 Jan");
});

test("whole days from one date to another, across months and years, and back", () => {
  expect(daysFrom("2026-11-13", "2026-11-13")).toBe(0);
  expect(daysFrom("2026-11-13", "2026-11-14")).toBe(1);
  expect(daysFrom("2026-11-30", "2026-12-01")).toBe(1);
  expect(daysFrom("2026-12-31", "2027-01-01")).toBe(1);
  expect(daysFrom("2026-11-13", "2027-01-12")).toBe(60);
  expect(daysFrom("2026-11-14", "2026-11-13")).toBe(-1);
  expect(daysFrom("2027-01-01", "2026-11-13")).toBe(-49);
  // A leap day counts.
  expect(daysFrom("2028-02-28", "2028-03-01")).toBe(2);
});

test("a run of days is in its month, or across two", () => {
  expect(formatMonthSpan("2026-11-13", "2026-11-17")).toBe("November");
  expect(formatMonthSpan("2026-11-28", "2026-12-02")).toBe("November – December");
  expect(formatMonthSpan("2026-12-30", "2027-01-03")).toBe("December – January");
});

test("the weekday of a date, numbered as the API numbers it", () => {
  expect(weekdayOf("2026-11-13")).toBe(5);
  expect(weekdayOf("2026-11-14")).toBe(6);
  expect(weekdayOf("2026-11-15")).toBe(0);
  expect(weekdayOf("2027-01-01")).toBe(5);
});

test("a day to tap: its weekday and its day of the month", () => {
  expect(dayParts("2026-11-13")).toEqual({ weekday: "Fri", day: 13 });
  expect(dayParts("2026-11-01")).toEqual({ weekday: "Sun", day: 1 });
});
