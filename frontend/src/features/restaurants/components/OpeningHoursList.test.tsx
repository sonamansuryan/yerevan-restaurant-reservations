// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import { OpeningHoursList } from "@/features/restaurants/components/OpeningHoursList";
import type { OpeningHours } from "@/types/api";

afterEach(cleanup);

const hours = (dayOfWeek: number, opensAt: number, closesAt: number): OpeningHours => {
  const time = (minutes: number): string =>
    `${String(Math.floor((minutes % 1440) / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  return { dayOfWeek, opensAt, closesAt, opens: time(opensAt), closes: time(closesAt) };
};

// Tsiran Wine Room: closed on Monday, late on Friday.
const tsiran = [hours(0, 1080, 1380), hours(2, 1080, 1380), hours(5, 1080, 1560)];

/** Each line of the list, day first, then its hours as shown and as screen readers hear them. */
function lines(): string[] {
  return screen
    .getAllByRole("term")
    .map((term) => `${term.textContent} ${term.nextElementSibling?.textContent}`);
}

test("lists the whole week, Monday first, with closed days and a late night as they are", () => {
  render(<OpeningHoursList hours={tsiran} />);

  expect(lines()).toEqual([
    "Monday Closed",
    "Tuesday 18:00 – 23:0018:00 to 23:00",
    "Wednesday Closed",
    "Thursday Closed",
    "Friday 18:00 – 02:0018:00 to 02:00",
    "Saturday Closed",
    "Sunday 18:00 – 23:0018:00 to 23:00",
  ]);
});

test("screen readers hear 'to' between the times, not a dash", () => {
  render(<OpeningHoursList hours={tsiran} />);

  expect(screen.getByText("18:00 to 02:00").className).toContain("sr-only");
  expect(screen.getByText("18:00 – 02:00").getAttribute("aria-hidden")).toBe("true");
});

test("a split shift shows both times on that day's line", () => {
  render(<OpeningHoursList hours={[hours(1, 720, 900), hours(1, 1080, 1380)]} />);

  expect(screen.getAllByRole("definition")[0]?.textContent).toBe(
    "12:00 – 15:0012:00 to 15:0018:00 – 23:0018:00 to 23:00",
  );
});

test("today's line is marked, and only today's", () => {
  render(<OpeningHoursList hours={tsiran} today={5} />);

  const marked = screen
    .getAllByRole("term")
    .filter((term) => term.textContent?.includes("(today)"));
  expect(marked.map((term) => term.textContent)).toEqual(["Friday (today)"]);
  // In bold, the day and its hours.
  expect(marked[0]?.className).toContain("font-semibold");
  expect(marked[0]?.nextElementSibling?.className).toContain("font-semibold");
  expect(screen.getByText("Tuesday").className).not.toContain("font-semibold");
});

test("a restaurant with no hours yet says so instead of a week of Closed", () => {
  render(<OpeningHoursList hours={[]} />);

  expect(screen.getByText("Opening hours aren’t listed yet.")).toBeDefined();
  expect(screen.queryByRole("term")).toBeNull();
});

test("open from midnight to midnight reads as open all day, not 00:00–00:00", () => {
  render(<OpeningHoursList hours={[hours(1, 0, 1440), hours(2, 660, 1440)]} />);

  expect(lines().slice(0, 2)).toEqual([
    "Monday Open all day",
    "Tuesday 11:00 – 00:0011:00 to 00:00",
  ]);
});
