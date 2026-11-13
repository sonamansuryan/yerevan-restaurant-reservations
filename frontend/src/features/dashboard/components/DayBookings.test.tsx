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

  test("one line per booking: time, status, guest and note, party, and table with its area", () => {
    const [, , confirmed] = lines();
    if (!confirmed) throw new Error("No third booking");
    const line = within(confirmed);

    // Screen readers hear the time from start to end. On screen, the end sits under the start.
    expect(line.getByText("19:00 to 21:00").className).toContain("sr-only");
    expect(line.getByText("to 21:00").getAttribute("aria-hidden")).toBe("true");
    expect(line.getByText("Confirmed")).toBeDefined();
    expect(line.getByText("Anahit Petrosyan")).toBeDefined();
    expect(line.getByText("Birthday dinner")).toBeDefined();
    expect(line.getByText("4 guests")).toBeDefined();
    expect(line.getByText("Table T3")).toBeDefined();
    expect(line.getByText("Indoor")).toBeDefined();
  });

  test("the columns' names are for the eye: each line says its own in full", () => {
    lines();

    const names = screen.getByText("Actions").parentElement;
    expect(names?.getAttribute("aria-hidden")).toBe("true");
    expect(Array.from(names?.children ?? [], (name) => name.textContent)).toEqual([
      "Time",
      "Guest",
      "Party",
      "Table",
      "Status",
      "Actions",
    ]);
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

describe("narrowing the day", () => {
  // Whose bookings are listed, in order: each line is known by its guest's name.
  const names = fridayBookings.map(({ guest }) => guest.name);
  const guestsShown = (): (string | undefined)[] =>
    screen
      .queryAllByRole("listitem")
      .map((line) => names.find((name) => line.textContent?.includes(name)));

  test("the statuses on the day narrow it, each with its count, and All brings them all back", async () => {
    render(<DayBookings reservations={fridayBookings} />);

    const show = screen.getByRole("group", { name: "Show" });
    expect(
      within(show)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual([
      "All (6)",
      "Pending (1)",
      "Confirmed (2)",
      "Arrived (1)",
      "No-show (1)",
      "Cancelled (1)",
    ]);
    const all = within(show).getByRole("button", { name: "All (6)" });
    expect(all.getAttribute("aria-pressed")).toBe("true");

    const confirmed = within(show).getByRole("button", { name: "Confirmed (2)" });
    await userEvent.click(confirmed);

    expect(confirmed.getAttribute("aria-pressed")).toBe("true");
    expect(all.getAttribute("aria-pressed")).toBe("false");
    expect(guestsShown()).toEqual(["Anahit Petrosyan", "Գոհար Մկրտչյան"]);

    await userEvent.click(all);
    expect(guestsShown()).toHaveLength(6);
  });

  test("a status no booking has isn't offered", () => {
    const [arrived, noShow] = fridayBookings;
    if (!arrived || !noShow) throw new Error("No sample bookings");
    render(<DayBookings reservations={[arrived, noShow]} />);

    const show = screen.getByRole("group", { name: "Show" });
    expect(
      within(show)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["All (2)", "Arrived (1)", "No-show (1)"]);
  });

  test("the search finds a guest by name or a table by its name, or says nothing matches", async () => {
    render(<DayBookings reservations={fridayBookings} />);
    const search = screen.getByRole("searchbox", { name: "Search guests or tables" });

    await userEvent.type(search, "ANAHIT");
    expect(guestsShown()).toEqual(["Anahit Petrosyan"]);

    await userEvent.clear(search);
    await userEvent.type(search, "t1");
    expect(guestsShown()).toEqual(["Lilit Harutyunyan", "Գոհար Մկրտչյան"]);

    await userEvent.clear(search);
    await userEvent.type(search, "Nobody");
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getByText("No bookings match.")).toBeDefined();
  });

  test("without narrowing, as when the day doesn't fit on one page, every booking shows, unfiltered", () => {
    render(<DayBookings reservations={fridayBookings} narrowing={false} />);

    expect(screen.queryByRole("group", { name: "Show" })).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
  });
});

describe("moving a booking on", () => {
  // As at 19:10: Anahit's 19:00 has started, Aram's 19:30 is pending, and Gohar's 22:30 is ahead.
  const [, , anahit, aram] = fridayBookings;
  const ANAHIT = "Anahit Petrosyan, 19:00";
  const ARAM = "Aram Khachatryan, 19:30";
  // The changes are in the bookings' list. The day's statuses above it are buttons too.
  const changes = (): HTMLElement[] => within(screen.getByRole("list")).queryAllByRole("button");

  function renderDay(changing: { id: string; status: "CONFIRMED" } | null = null) {
    const onChange = vi.fn();
    render(<DayBookings reservations={fridayBookings} onChange={onChange} changing={changing} />);
    return onChange;
  }

  test("a day that's only read offers no changes", () => {
    render(<DayBookings reservations={fridayBookings} />);

    expect(changes()).toEqual([]);
  });

  test("each booking offers only the changes the server allows, the usual next step first", () => {
    renderDay();

    const offered = changes().map((button) => button.ariaLabel);
    // Cancelling a booking still waiting for the restaurant is declining it.
    expect(offered).toEqual([
      `Mark arrived, ${ANAHIT}`,
      `Mark no-show, ${ANAHIT}`,
      `Cancel, ${ANAHIT}`,
      `Confirm, ${ARAM}`,
      `Decline, ${ARAM}`,
      "Cancel, Գոհար Մկրտչյան, 22:30",
    ]);
    expect(changes().map((button) => button.textContent)).toEqual([
      "Mark arrived",
      "Mark no-show",
      "Cancel",
      "Confirm",
      "Decline",
      "Cancel",
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

    await userEvent.click(screen.getByRole("button", { name: `Decline, ${ARAM}` }));
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

    await userEvent.click(screen.getByRole("button", { name: `Decline, ${ARAM}` }));
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
      screen.getByRole<HTMLButtonElement>("button", { name: `Decline, ${ARAM}` }).disabled,
    ).toBe(true);
    // Other bookings can still be moved on.
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: `Cancel, ${ANAHIT}` }).disabled,
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

  const line = screen.getByRole("listitem");
  expect(within(line).getByText("Table 1")).toBeDefined();
  expect(line.textContent).not.toContain("Table Table");
});

describe("moving between days", () => {
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

  test("on today, Today is marked as the day shown", () => {
    renderNav("2026-11-13");

    const days = screen.getByRole("navigation", { name: "Days" });
    expect(within(days).getByRole("link", { name: "Today" }).getAttribute("aria-current")).toBe(
      "page",
    );
    // The day is said in the part's heading, above, not here.
    expect(screen.queryByRole("heading")).toBeNull();
  });

  test("the days on either side are links, across the end of a month too", () => {
    renderNav("2026-11-30");

    expect(href("Previous day")).toBe("/?date=2026-11-29");
    expect(href("Next day")).toBe("/?date=2026-12-01");
    expect(href("Today")).toBe("/?date=2026-11-13");
    // Another day is shown, so Today isn't marked.
    expect(screen.getByRole("link", { name: "Today" }).getAttribute("aria-current")).toBeNull();
  });

  test("Show opens the date chosen", async () => {
    const onGoTo = renderNav("2026-11-13");

    fireEvent.change(screen.getByLabelText("Go to"), { target: { value: "2026-12-24" } });
    await userEvent.click(screen.getByRole("button", { name: "Show" }));

    expect(onGoTo).toHaveBeenCalledWith("2026-12-24");
  });

  test("Show with no date says what's missing, and goes nowhere", async () => {
    const onGoTo = renderNav("2026-11-13");

    fireEvent.change(screen.getByLabelText("Go to"), { target: { value: "" } });
    await userEvent.click(screen.getByRole("button", { name: "Show" }));

    expect(screen.getByText("Choose a date.")).toBeDefined();
    expect(screen.getByLabelText("Go to").getAttribute("aria-invalid")).toBe("true");
    expect(onGoTo).not.toHaveBeenCalled();
  });
});
