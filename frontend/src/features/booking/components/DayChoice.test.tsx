// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

import { DayChoice } from "@/features/booking/components/DayChoice";

afterEach(cleanup);

const TODAY = "2026-11-13";

/** The days in the row, by the names screen readers hear: the arrows aren't days. */
function dayNames(): string[] {
  return screen
    .getAllByRole("button")
    .map((button) => button.getAttribute("aria-label") ?? "")
    .filter((name) => name !== "Earlier days" && name !== "Later days");
}

const earlier = (): HTMLButtonElement =>
  screen.getByRole<HTMLButtonElement>("button", { name: "Earlier days" });
const later = (): HTMLButtonElement =>
  screen.getByRole<HTMLButtonElement>("button", { name: "Later days" });

test("five days from today, each named by its whole date, the chosen one pressed", () => {
  render(<DayChoice date="2026-11-14" today={TODAY} onChoose={vi.fn()} />);

  expect(dayNames()).toEqual([
    "Friday 13 November",
    "Saturday 14 November",
    "Sunday 15 November",
    "Monday 16 November",
    "Tuesday 17 November",
  ]);
  expect(
    screen.getByRole("button", { name: "Saturday 14 November" }).getAttribute("aria-pressed"),
  ).toBe("true");
  expect(
    screen.getByRole("button", { name: "Friday 13 November" }).getAttribute("aria-pressed"),
  ).toBe("false");
  expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(1);
});

test("each day shows its weekday over its date", () => {
  render(<DayChoice date={TODAY} today={TODAY} onChoose={vi.fn()} />);

  expect(screen.getByRole("button", { name: "Friday 13 November" }).textContent).toBe("Fri13");
});

test("the days and the arrows are one group, named Date", () => {
  render(<DayChoice date={TODAY} today={TODAY} onChoose={vi.fn()} />);

  expect(screen.getByRole("group", { name: "Date" })).toBeDefined();
});

test("today's row can't go earlier", () => {
  render(<DayChoice date={TODAY} today={TODAY} onChoose={vi.fn()} />);

  expect(earlier().disabled).toBe(true);
  expect(later().disabled).toBe(false);
});

test("later moves the row by five days, and earlier brings it back", async () => {
  render(<DayChoice date={TODAY} today={TODAY} onChoose={vi.fn()} />);

  await userEvent.click(later());

  expect(dayNames()).toEqual([
    "Wednesday 18 November",
    "Thursday 19 November",
    "Friday 20 November",
    "Saturday 21 November",
    "Sunday 22 November",
  ]);
  expect(earlier().disabled).toBe(false);

  await userEvent.click(earlier());

  expect(dayNames()[0]).toBe("Friday 13 November");
});

test("the last row ends on the last day guests can book, and goes no later", async () => {
  render(<DayChoice date={TODAY} today={TODAY} last="2026-11-20" onChoose={vi.fn()} />);

  await userEvent.click(later());

  expect(dayNames()).toEqual([
    "Wednesday 18 November",
    "Thursday 19 November",
    "Friday 20 November",
  ]);
  expect(later().disabled).toBe(true);
});

test("a row that ends on the last day is the last row", () => {
  render(<DayChoice date={TODAY} today={TODAY} last="2026-11-17" onChoose={vi.fn()} />);

  expect(later().disabled).toBe(true);
});

test("without a last day, the rows run 60 days ahead", async () => {
  render(<DayChoice date="2027-01-08" today={TODAY} onChoose={vi.fn()} />);

  // 56 days ahead, so the row from 55 days ahead, and then the last day alone.
  expect(dayNames()[0]).toBe("Thursday 7 January 2027");
  expect(later().disabled).toBe(false);

  await userEvent.click(later());

  expect(dayNames()).toEqual(["Tuesday 12 January 2027"]);
  expect(later().disabled).toBe(true);
});

test("choosing a day says which", async () => {
  const onChoose = vi.fn();
  render(<DayChoice date={TODAY} today={TODAY} onChoose={onChoose} />);

  await userEvent.click(screen.getByRole("button", { name: "Sunday 15 November" }));

  expect(onChoose).toHaveBeenCalledWith("2026-11-15");
});

test("a day chosen elsewhere, outside the row, moves the row to it", () => {
  const { rerender } = render(<DayChoice date={TODAY} today={TODAY} onChoose={vi.fn()} />);

  rerender(<DayChoice date="2026-11-25" today={TODAY} onChoose={vi.fn()} />);

  expect(dayNames()).toEqual([
    "Monday 23 November",
    "Tuesday 24 November",
    "Wednesday 25 November",
    "Thursday 26 November",
    "Friday 27 November",
  ]);
  expect(
    screen.getByRole("button", { name: "Wednesday 25 November" }).getAttribute("aria-pressed"),
  ).toBe("true");
});

test("the row the guest moved to stays while the day chosen is in it, or hasn't changed", async () => {
  const { rerender } = render(<DayChoice date={TODAY} today={TODAY} onChoose={vi.fn()} />);

  await userEvent.click(later());
  rerender(<DayChoice date={TODAY} today={TODAY} onChoose={vi.fn()} />);
  expect(dayNames()[0]).toBe("Wednesday 18 November");

  rerender(<DayChoice date="2026-11-20" today={TODAY} onChoose={vi.fn()} />);
  expect(dayNames()[0]).toBe("Wednesday 18 November");
});

test("the month shows above the row, or both months when the row crosses into the next", async () => {
  render(<DayChoice date="2026-11-24" today={TODAY} onChoose={vi.fn()} />);

  // 23 to 27 November.
  expect(screen.getByText("November")).toBeDefined();

  await userEvent.click(later());

  // 28 November to 2 December.
  expect(screen.getByText("November – December")).toBeDefined();
});
