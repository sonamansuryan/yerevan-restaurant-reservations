// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import type { To } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { DayBookings } from "@/features/dashboard/components/DayBookings";
import { DayNav } from "@/features/dashboard/components/DayNav";
import { fridayBookings } from "@/features/design/samples";

// jsdom has no showModal(), which Modal uses. These open and close it the simple way.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
});

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

describe("moving a booking on", () => {
  // As at 19:10: Anahit's 19:00 has started, Aram's 19:30 is pending, and Gohar's 22:30 is ahead.
  const [, , anahit, aram] = fridayBookings;
  const ANAHIT = "Anahit Petrosyan, 19:00";
  const ARAM = "Aram Khachatryan, 19:30";

  function renderDay(changing: { id: string; status: "CONFIRMED" } | null = null) {
    const onChange = vi.fn();
    render(<DayBookings reservations={fridayBookings} onChange={onChange} changing={changing} />);
    return onChange;
  }

  test("a day that's only read offers no changes", () => {
    render(<DayBookings reservations={fridayBookings} />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  test("each booking offers only the changes the server allows, the usual next step first", () => {
    renderDay();

    const offered = screen.getAllByRole("button").map((button) => button.ariaLabel);
    expect(offered).toEqual([
      `Mark arrived, ${ANAHIT}`,
      `Mark no-show, ${ANAHIT}`,
      `Cancel booking, ${ANAHIT}`,
      `Confirm, ${ARAM}`,
      `Cancel booking, ${ARAM}`,
      "Cancel booking, Գոհար Մկրտչյան, 22:30",
    ]);
  });

  test("confirming and marking a guest arrived are sent at once", async () => {
    const onChange = renderDay();

    await userEvent.click(screen.getByRole("button", { name: `Confirm, ${ARAM}` }));
    await userEvent.click(screen.getByRole("button", { name: `Mark arrived, ${ANAHIT}` }));

    expect(onChange).toHaveBeenNthCalledWith(1, aram, { status: "CONFIRMED" });
    expect(onChange).toHaveBeenNthCalledWith(2, anahit, { status: "ARRIVED" });
  });

  test("a no-show can't be undone, so it asks first, and Keep it changes nothing", async () => {
    const onChange = renderDay();

    await userEvent.click(screen.getByRole("button", { name: `Mark no-show, ${ANAHIT}` }));
    const question = screen.getByRole("dialog", { name: "Mark as a no-show?" });
    expect(question.textContent).toContain(
      "Anahit Petrosyan didn’t come for their table at 19:00. This can’t be undone.",
    );
    await userEvent.click(within(question).getByRole("button", { name: "Keep it" }));
    expect(onChange).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: `Mark no-show, ${ANAHIT}` }));
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Mark no-show" }),
    );
    expect(onChange).toHaveBeenCalledWith(anahit, { status: "NO_SHOW" });
  });

  test("cancelling asks first, with room for a reason the guest will see", async () => {
    const onChange = renderDay();

    await userEvent.click(screen.getByRole("button", { name: `Cancel booking, ${ARAM}` }));
    const question = screen.getByRole("dialog", { name: "Cancel this booking?" });
    expect(question.textContent).toContain(
      "Aram Khachatryan’s table at 19:30 will be offered to other guests.",
    );
    await userEvent.type(
      within(question).getByLabelText("Reason for the guest"),
      "  We’re closed tonight.  ",
    );
    await userEvent.click(within(question).getByRole("button", { name: "Cancel booking" }));

    expect(onChange).toHaveBeenCalledWith(aram, {
      status: "CANCELLED",
      reason: "We’re closed tonight.",
    });
  });

  test("the reason is optional, and a long one is refused before anything is sent", async () => {
    const onChange = renderDay();

    await userEvent.click(screen.getByRole("button", { name: `Cancel booking, ${ARAM}` }));
    const reason = within(screen.getByRole("dialog")).getByLabelText("Reason for the guest");
    fireEvent.change(reason, { target: { value: "x".repeat(201) } });
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel booking" }),
    );
    expect(await screen.findByText("Use 200 characters or fewer.")).toBeDefined();
    expect(onChange).not.toHaveBeenCalled();

    await userEvent.clear(reason);
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel booking" }),
    );
    expect(onChange).toHaveBeenCalledWith(aram, { status: "CANCELLED", reason: undefined });
  });

  test("while a change is sent, its button waits and the booking's others are held", () => {
    renderDay({ id: aram!.id, status: "CONFIRMED" });

    expect(screen.getByRole("button", { name: `Confirm, ${ARAM}` }).ariaBusy).toBe("true");
    expect(
      (screen.getByRole("button", { name: `Cancel booking, ${ARAM}` }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    // Other bookings can still be moved on.
    expect(
      (screen.getByRole("button", { name: `Cancel booking, ${ANAHIT}` }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });
});

test("a table whose name already says so isn't called a table twice", () => {
  const [first] = fridayBookings;
  if (!first) throw new Error("No sample booking");

  render(
    <DayBookings
      reservations={[{ ...first, table: { id: "table-1", label: "Table 1", zone: "INDOOR" } }]}
    />,
  );

  expect(screen.getByRole("listitem").textContent).toContain("Table 1 · Indoor · 2 guests");
  expect(screen.getByRole("listitem").textContent).not.toContain("Table Table");
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
