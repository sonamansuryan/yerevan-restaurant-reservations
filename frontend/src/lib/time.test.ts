import { expect, test } from "vitest";

import { formatBookDate } from "@/lib/time";

test("a day reads like a page of the book", () => {
  expect(formatBookDate(new Date("2026-11-06T12:00:00Z"))).toBe("Friday 6 November");
});

test("it's the date in Yerevan, which is already tomorrow late in the UTC evening", () => {
  // 21:30 UTC is 01:30 the next morning in Yerevan.
  expect(formatBookDate(new Date("2026-11-06T21:30:00Z"))).toBe("Saturday 7 November");
});
