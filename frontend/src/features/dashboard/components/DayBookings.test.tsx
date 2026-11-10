// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import type { To } from "react-router";
import { afterEach, describe, expect, test, vi } from "vitest";

import { DayBookings } from "@/features/dashboard/components/DayBookings";
import { DayNav } from "@/features/dashboard/components/DayNav";
import { fridayBookings } from "@/features/design/samples";

afterEach(cleanup);

describe("a day's bookings", () => {
  const lines = (): HTMLElement[] => {
    render(<DayBookings reservations={fridayBookings} />);
    return screen.getAllByRole("listitem");
  };

  test("one line per booking: time, guest, table, party and status", () => {
    const confirmed = lines()[2];

    expect(confirmed?.textContent).toContain("19:00 to 21:00");
    expect(confirmed?.textContent).toContain("Anahit Petrosyan");
    expect(confirmed?.textContent).toContain("Table T3 · Indoor · 4 guests");
    expect(confirmed?.textContent).toContain("Confirmed");
    expect(confirmed?.textContent).toContain("Note: Birthday dinner");
  });

  test("a cancelled booking stays, crossed out, with who cancelled and why", () => {
    const cancelled = lines()[4];

    expect(cancelled?.textContent).toContain("Cancelled");
    expect(cancelled?.textContent).toContain(
      "Cancelled by the restaurant: We have a private event that evening.",
    );
    expect(cancelled?.querySelector(".line-through")?.textContent).toContain("20:00");
  });

  test("a booking past midnight shows its real end, and an Armenian name as it is", () => {
    const late = lines()[5];

    expect(late?.textContent).toContain("22:30 to 00:30");
    expect(late?.textContent).toContain("Գոհար Մկրտչյան");
  });
});

describe("the day's heading and ways around", () => {
  // Days are links, so each points where hrefFor says.
  const hrefFor = (date: string): To => ({ search: `?date=${date}` });

  function renderNav(date: string, onGoTo = vi.fn()): typeof onGoTo {
    render(
      <MemoryRouter>
        <DayNav date={date} today="2026-11-13" hrefFor={hrefFor} onGoTo={onGoTo} />
      </MemoryRouter>,
    );
    return onGoTo;
  }

  const href = (name: string): string | null =>
    screen.getByRole("link", { name }).getAttribute("href");

  test("today is headed as the book would, and marked", () => {
    renderNav("2026-11-13");

    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Friday 13 November");
    expect(screen.getByText("Today")).toBeDefined();
    // Already on today, so there's no link to it.
    expect(screen.queryByRole("link", { name: "Today" })).toBeNull();
  });

  test("the days on either side are links, across the end of a month too", () => {
    renderNav("2026-11-30");

    expect(href("Previous day")).toBe("/?date=2026-11-29");
    expect(href("Next day")).toBe("/?date=2026-12-01");
    expect(href("Today")).toBe("/?date=2026-11-13");
  });

  test("another year's date says its year", () => {
    renderNav("2027-01-05");

    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Tuesday 5 January 2027");
  });

  test("Show opens the date chosen", async () => {
    const onGoTo = renderNav("2026-11-13");

    fireEvent.change(screen.getByLabelText("Go to a date"), { target: { value: "2026-12-24" } });
    await userEvent.click(screen.getByRole("button", { name: "Show" }));

    expect(onGoTo).toHaveBeenCalledWith("2026-12-24");
  });

  test("Show with no date says what's missing, and goes nowhere", async () => {
    const onGoTo = renderNav("2026-11-13");

    fireEvent.change(screen.getByLabelText("Go to a date"), { target: { value: "" } });
    await userEvent.click(screen.getByRole("button", { name: "Show" }));

    expect(screen.getByText("Choose a date.")).toBeDefined();
    expect(onGoTo).not.toHaveBeenCalled();
  });
});
