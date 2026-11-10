import { expect, test } from "vitest";

import { formatBookDate, yerevanWeekday } from "@/lib/time";

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
