import { expect, test } from "vitest";

import { weekRows } from "@/features/restaurants/openingHours";
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
