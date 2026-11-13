// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test, vi } from "vitest";

import { BookingWidget } from "@/features/booking/components/BookingWidget";
import { loriSaturday, sampleBooked } from "@/features/design/samples";
import { ApiError } from "@/lib/api";
import type { TableZone } from "@/types/api";

afterEach(cleanup);

type Props = ComponentProps<typeof BookingWidget>;

const SATURDAY = { date: "2026-11-14", guests: 2, time: null, tableId: null };
const AT_T2 = { ...SATURDAY, time: "19:00", tableId: "table-t2" };
// The booking button's words for T2 at 19:00 on the demo Saturday.
const RESERVE_T2 = "Reserve for 2 · Sat 14 Nov, 19:00";

function renderWidget(props: Partial<Props> = {}): Props {
  const all: Props = {
    choices: SATURDAY,
    today: "2026-11-13",
    availability: { data: loriSaturday, failed: false, retrying: false, onRetry: vi.fn() },
    viewer: { kind: "guest", name: "Lilit Harutyunyan" },
    sending: false,
    refusal: null,
    booked: null,
    onChoose: vi.fn(),
    onBook: vi.fn(),
    onBookAnother: vi.fn(),
    ...props,
  };
  render(
    <MemoryRouter>
      <BookingWidget {...all} />
    </MemoryRouter>,
  );
  return all;
}

test("the day's times come as lunch and dinner, and a full one can't be chosen", () => {
  renderWidget();

  expect(screen.getByText("Lunch")).toBeDefined();
  expect(screen.getByText("Dinner")).toBeDefined();
  expect(screen.getByRole("button", { name: "13:00, full" }).hasAttribute("disabled")).toBe(true);
  // Beside "Time": every time but 13:00 has a table for two.
  expect(screen.getByText("9 times available")).toBeDefined();
});

test("a time chosen asks for its tables, and an earlier choice clears the later ones", async () => {
  const { onChoose } = renderWidget({ choices: AT_T2 });

  await userEvent.click(screen.getByRole("button", { name: "21:00" }));
  await userEvent.click(screen.getByRole("button", { name: "More guests" }));
  await userEvent.click(screen.getByRole("button", { name: "Sunday 15 November" }));

  expect(onChoose).toHaveBeenNthCalledWith(1, { time: "21:00", tableId: null });
  expect(onChoose).toHaveBeenNthCalledWith(2, { guests: 3, time: null, tableId: null });
  expect(onChoose).toHaveBeenNthCalledWith(3, { date: "2026-11-15", time: null, tableId: null });
});

test("the party is one to twenty guests, said as it changes", async () => {
  const { onChoose } = renderWidget({ choices: { ...SATURDAY, guests: 1 } });

  const party = screen.getByRole("group", { name: "Guests" });
  expect(within(party).getByText("1 guest").tagName).toBe("OUTPUT");
  expect(within(party).getByRole("button", { name: "Fewer guests" }).hasAttribute("disabled")).toBe(
    true,
  );
  await userEvent.click(within(party).getByRole("button", { name: "More guests" }));
  expect(onChoose).toHaveBeenCalledWith({ guests: 2, time: null, tableId: null });
  cleanup();

  renderWidget({ choices: { ...SATURDAY, guests: 20 } });
  expect(screen.getByText("20 guests")).toBeDefined();
  expect(screen.getByRole("button", { name: "More guests" }).hasAttribute("disabled")).toBe(true);
});

test("the days come five at a time under their month, each named in full, the chosen one pressed", async () => {
  renderWidget();

  const dates = screen.getByRole("group", { name: "Date" });
  const days = (): HTMLElement[] =>
    within(dates)
      .getAllByRole("button")
      .filter((button) => button.hasAttribute("aria-pressed"));
  expect(within(dates).getByText("November")).toBeDefined();
  expect(days().map((day) => day.getAttribute("aria-label"))).toEqual([
    "Friday 13 November",
    "Saturday 14 November",
    "Sunday 15 November",
    "Monday 16 November",
    "Tuesday 17 November",
  ]);
  expect(days().map((day) => day.getAttribute("aria-pressed"))).toEqual([
    "false",
    "true",
    "false",
    "false",
    "false",
  ]);
  // The row starts today, so there's nothing earlier to show.
  const earlier = within(dates).getByRole("button", { name: "Earlier days" });
  expect(earlier.hasAttribute("disabled")).toBe(true);

  await userEvent.click(within(dates).getByRole("button", { name: "Later days" }));

  expect(days().map((day) => day.getAttribute("aria-label"))).toEqual([
    "Wednesday 18 November",
    "Thursday 19 November",
    "Friday 20 November",
    "Saturday 21 November",
    "Sunday 22 November",
  ]);
  expect(earlier.hasAttribute("disabled")).toBe(false);
});

test("the tables free at that time each say their area and seats, and the best fit is marked", async () => {
  const { onChoose } = renderWidget({ choices: { ...SATURDAY, time: "19:00" } });

  const tables = screen.getByRole("group", { name: "Available tables at 19:00" });
  // A radio is named by its whole box. jsdom applies no CSS, so the box's lines run together in
  // the name, where a browser puts a space between them, so a table is found by its first words.
  // T1 is booked at 19:00 in the demo.
  expect(within(tables).queryByRole("radio", { name: /^T1/ })).toBeNull();
  const t2 = within(tables).getByRole("radio", { name: /^T2/ });
  expect(t2.closest("label")?.textContent).toContain("Indoor · 2 seats");
  expect(within(tables).getByText("Terrace · 4 seats")).toBeDefined();
  // The smallest table that takes the party, so bigger ones stay free for bigger parties.
  expect(within(tables).getAllByText("Best fit")).toHaveLength(1);
  expect(within(tables).getByText("Best fit").closest("label")).toBe(t2.closest("label"));

  await userEvent.click(t2);

  expect(onChoose).toHaveBeenCalledWith({ tableId: "table-t2" });
});

test("tables come in the order of their names, numbers counted as numbers, whatever their area", () => {
  const table = (id: string, label: string, zone: TableZone) => ({ id, label, zone, capacity: 4 });
  const [first] = loriSaturday.slots;
  if (!first) throw new Error("No sample time");
  const slot = {
    ...first,
    tables: [
      table("c", "T10", "INDOOR"),
      table("p", "P1", "TERRACE"),
      table("b", "T2", "INDOOR"),
      table("a", "T1", "INDOOR"),
    ],
  };
  renderWidget({
    choices: { ...SATURDAY, time: slot.starts },
    availability: {
      data: { ...loriSaturday, slots: [slot] },
      failed: false,
      retrying: false,
      onRetry: vi.fn(),
    },
  });

  // The radios, which are what's chosen, and the names shown come in the same order.
  expect(screen.getAllByRole<HTMLInputElement>("radio").map((radio) => radio.value)).toEqual([
    "p",
    "a",
    "b",
    "c",
  ]);
  expect(screen.getAllByText(/^[PT]\d+$/).map((name) => name.textContent)).toEqual([
    "P1",
    "T1",
    "T2",
    "T10",
  ]);
});

test("until a time and a table are chosen, the button waits and says what's missing", () => {
  renderWidget();
  expect(
    screen.getByText("Choose a time to see which tables are free.", { exact: false }),
  ).toBeDefined();
  expect(
    screen.getByRole("button", { name: "Choose a time and table" }).hasAttribute("disabled"),
  ).toBe(true);
  cleanup();

  renderWidget({ choices: { ...SATURDAY, time: "19:00" } });
  expect(screen.getByRole("button", { name: "Choose a table" }).hasAttribute("disabled")).toBe(
    true,
  );
});

test("a chosen table's button says what it books, and booking sends the note, trimmed", async () => {
  const { onBook } = renderWidget({ choices: AT_T2 });

  expect(screen.getByRole<HTMLInputElement>("radio", { name: /^T2/ }).checked).toBe(true);
  expect(screen.getByText("The table is yours until 21:00. No payment needed.")).toBeDefined();
  await userEvent.type(
    screen.getByLabelText("Note for the restaurant (optional)"),
    "  A window seat  ",
  );
  await userEvent.click(screen.getByRole("button", { name: RESERVE_T2 }));

  expect(onBook).toHaveBeenCalledWith("A window seat");
});

test("a table chosen earlier that isn't free any more says so above the tables, and can't be booked", () => {
  // T1 is booked at 19:00 in the demo.
  renderWidget({ choices: { ...AT_T2, tableId: "table-t1" } });

  const alert = screen.getByRole("alert");
  expect(alert.textContent).toBe(
    "The table you chose isn’t free at 19:00 any more. Choose another.",
  );
  const tables = screen.getByRole("group", { name: "Available tables at 19:00" });
  expect(alert.compareDocumentPosition(tables)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  expect(screen.queryByRole("button", { name: /^Reserve/ })).toBeNull();
  expect(screen.getByRole("button", { name: "Choose a table" }).hasAttribute("disabled")).toBe(
    true,
  );
});

test("so does a time that isn't free any more, above the times", () => {
  // Every table is taken at 13:00 in the demo.
  renderWidget({ choices: { ...AT_T2, time: "13:00" } });

  expect(screen.getByRole("alert").textContent).toBe(
    "13:00 isn’t free any more. Choose another time.",
  );
});

test("after a refusal, focus moves to the reason, because the button pressed has gone", () => {
  const taken = new ApiError(409, "SLOT_TAKEN", "Sorry, this table was just booked for that time.");
  renderWidget({ choices: { ...SATURDAY, time: "19:00" }, refusal: taken });

  expect(document.activeElement).toBe(screen.getByRole("alert").parentElement);
});

test("while it books, the button is busy", () => {
  renderWidget({ choices: AT_T2, sending: true });

  expect(screen.getByRole("button", { name: RESERVE_T2 }).getAttribute("aria-busy")).toBe("true");
});

test("signed out, the last step is a link to sign in that knows the way back", () => {
  const signIn = {
    from: { pathname: "/restaurants/lori-smokehouse", search: "?time=19:00", hash: "" },
  };
  renderWidget({ choices: AT_T2, viewer: { kind: "signedOut", signIn } });

  expect(screen.getByRole("link", { name: "Sign in to reserve" }).getAttribute("href")).toBe(
    "/login",
  );
  expect(screen.getByText("You’ll come back to this table afterwards.")).toBeDefined();
  expect(screen.queryByRole("button", { name: /^Reserve/ })).toBeNull();
});

test("an account that isn't a guest's can't book, and is told why", () => {
  renderWidget({ choices: AT_T2, viewer: { kind: "notAGuest", name: "Ani Sargsyan" } });

  expect(
    screen.getByText("Tables are booked from a guest account. You’re signed in as Ani Sargsyan."),
  ).toBeDefined();
  expect(screen.queryByRole("button", { name: /^Reserve/ })).toBeNull();
});

test("a refusal shows above the tables", () => {
  const taken = new ApiError(409, "SLOT_TAKEN", "Sorry, this table was just booked for that time.");
  renderWidget({ choices: { ...SATURDAY, time: "19:00" }, refusal: taken });

  expect(screen.getByRole("alert").textContent).toBe(
    "Sorry, this table was just booked for that time.",
  );
});

test("a failure that leaves the table free shows by the button, not above the tables", () => {
  const offline = new ApiError(0, "NETWORK_ERROR", "We can't reach the server right now.");
  renderWidget({ choices: AT_T2, refusal: offline });

  const alert = screen.getByRole("alert");
  expect(alert.textContent).toBe("We can't reach the server right now.");
  expect(alert.nextElementSibling?.contains(screen.getByRole("button", { name: RESERVE_T2 }))).toBe(
    true,
  );
  const tables = screen.getByRole("group", { name: "Available tables at 19:00" });
  expect(tables.compareDocumentPosition(alert)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
});

test("when the times can't load, Try again asks again", async () => {
  const onRetry = vi.fn();
  renderWidget({ availability: { data: undefined, failed: true, retrying: false, onRetry } });

  await userEvent.click(screen.getByRole("button", { name: "Try again" }));

  expect(screen.getByText("We couldn’t load the times.")).toBeDefined();
  expect(onRetry).toHaveBeenCalledOnce();
});

test("a day with no times, or no table free, says so", () => {
  const ready = { failed: false, retrying: false, onRetry: vi.fn() };
  renderWidget({ availability: { ...ready, data: { ...loriSaturday, slots: [] } } });
  expect(screen.getByText("No times to book on this day. Try another date.")).toBeDefined();
  cleanup();

  const full = loriSaturday.slots.map((slot) => ({ ...slot, tables: [] }));
  renderWidget({ availability: { ...ready, data: { ...loriSaturday, slots: full } } });
  expect(
    screen.getByText("No table for 2 guests is free on this day. Try another date."),
  ).toBeDefined();
});

test("once booked, the card says it's waiting for the restaurant, and its heading takes focus", async () => {
  const { onBookAnother } = renderWidget({ booked: sampleBooked });

  const heading = screen.getByRole("heading", { name: "Booking requested" });
  expect(document.activeElement).toBe(heading);
  expect(screen.getByText("Waiting for the restaurant")).toBeDefined();
  expect(screen.getByText("Saturday 14 November, 19:00 to 21:00")).toBeDefined();
  expect(screen.getByText("Table T2 · Indoor · 2 guests")).toBeDefined();

  expect(screen.getByRole("link", { name: "View my reservations" }).getAttribute("href")).toBe(
    "/reservations",
  );

  await userEvent.click(screen.getByRole("button", { name: "Book another table" }));

  expect(onBookAnother).toHaveBeenCalledOnce();
});
