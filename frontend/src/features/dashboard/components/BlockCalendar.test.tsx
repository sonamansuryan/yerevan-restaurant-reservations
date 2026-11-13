// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";

import { BlockCalendar } from "@/features/dashboard/components/BlockCalendar";
import { sampleBlocks } from "@/features/design/samples";

afterEach(cleanup);

const FRIDAY = "2026-11-13";

const month = (): string => screen.getByRole("heading", { level: 3 }).textContent ?? "";

/** What screen readers hear instead of the days: the month's count. */
const summary = (): string =>
  screen.getByText(/^(This month:|Nothing blocked this month\.)/).textContent ?? "";

test("it opens on today's month", () => {
  render(<BlockCalendar blocks={sampleBlocks} today={FRIDAY} />);

  expect(month()).toBe("November 2026");
});

test("previous and next move a month at a time", async () => {
  render(<BlockCalendar blocks={sampleBlocks} today={FRIDAY} />);

  await userEvent.click(screen.getByRole("button", { name: "Previous month" }));
  expect(month()).toBe("October 2026");

  await userEvent.click(screen.getByRole("button", { name: "Next month" }));
  await userEvent.click(screen.getByRole("button", { name: "Next month" }));
  expect(month()).toBe("December 2026");
});

test("the months run on across the year's end, both ways", async () => {
  render(<BlockCalendar blocks={sampleBlocks} today="2026-12-20" />);

  await userEvent.click(screen.getByRole("button", { name: "Next month" }));
  expect(month()).toBe("January 2027");

  await userEvent.click(screen.getByRole("button", { name: "Previous month" }));
  await userEvent.click(screen.getByRole("button", { name: "Previous month" }));
  expect(month()).toBe("November 2026");
});

test("screen readers hear the month's blocked days counted, whole and partial", async () => {
  render(<BlockCalendar blocks={sampleBlocks} today={FRIDAY} />);

  // T4 on the 14th, and the whole restaurant from the evening of the 20th into the 21st.
  expect(summary()).toBe(
    "This month: 0 days blocked for the whole restaurant, 3 days partly blocked.",
  );

  await userEvent.click(screen.getByRole("button", { name: "Next month" }));
  // New Year's Eve.
  expect(summary()).toBe(
    "This month: 1 day blocked for the whole restaurant, 0 days partly blocked.",
  );

  await userEvent.click(screen.getByRole("button", { name: "Next month" }));
  // The holiday week, 1 to 7 January.
  expect(summary()).toBe(
    "This month: 7 days blocked for the whole restaurant, 0 days partly blocked.",
  );
});

test("one day partly blocked is one day", () => {
  render(<BlockCalendar blocks={sampleBlocks.slice(0, 1)} today={FRIDAY} />);

  expect(summary()).toBe(
    "This month: 0 days blocked for the whole restaurant, 1 day partly blocked.",
  );
});

test("a month with nothing blocked says so", async () => {
  render(<BlockCalendar blocks={sampleBlocks} today={FRIDAY} />);

  await userEvent.click(screen.getByRole("button", { name: "Previous month" }));

  expect(summary()).toBe("Nothing blocked this month.");
});

test("the count is for screen readers, and the days on the calendar for the eye", () => {
  render(<BlockCalendar blocks={[]} today={FRIDAY} />);

  expect(screen.getByText("Nothing blocked this month.").className).toContain("sr-only");
  // November 2026 has 30 days, which start on a Sunday, after six blank days from Monday.
  const days = screen.getByText("Mo").parentElement;
  expect(days?.getAttribute("aria-hidden")).toBe("true");
  expect(Array.from(days?.children ?? [], (day) => day.textContent)).toEqual([
    ...["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
    ...Array.from({ length: 6 }, () => ""),
    ...Array.from({ length: 30 }, (_, index) => String(index + 1)),
  ]);
});
