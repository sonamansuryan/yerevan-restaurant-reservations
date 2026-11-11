// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test, vi } from "vitest";

import { BookingWidget } from "@/features/booking/components/BookingWidget";
import { loriSaturday, sampleBooked } from "@/features/design/samples";
import { ApiError } from "@/lib/api";

afterEach(cleanup);

type Props = ComponentProps<typeof BookingWidget>;

const SATURDAY = { date: "2026-11-14", guests: 2, time: null, tableId: null };
const AT_T2 = { ...SATURDAY, time: "19:00", tableId: "table-t2" };

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
});

test("a time chosen asks for its tables, and an earlier choice clears the later ones", async () => {
  const { onChoose } = renderWidget({ choices: AT_T2 });

  await userEvent.click(screen.getByRole("button", { name: "21:00" }));
  await userEvent.selectOptions(screen.getByLabelText("Guests"), "4");
  fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-11-20" } });

  expect(onChoose).toHaveBeenNthCalledWith(1, { time: "21:00", tableId: null });
  expect(onChoose).toHaveBeenNthCalledWith(2, { guests: 4, time: null, tableId: null });
  expect(onChoose).toHaveBeenNthCalledWith(3, { date: "2026-11-20", time: null, tableId: null });
});

test("the tables free at that time come by area, each with its seats", async () => {
  const { onChoose } = renderWidget({ choices: { ...SATURDAY, time: "19:00" } });

  const tables = screen.getByRole("group", { name: "Table at 19:00" });
  expect(within(tables).getByText("Indoor")).toBeDefined();
  expect(within(tables).getByText("Terrace")).toBeDefined();
  // T1 is booked at 19:00 in the demo.
  expect(within(tables).queryByRole("radio", { name: /T1/ })).toBeNull();

  await userEvent.click(within(tables).getByRole("radio", { name: "T2 2 seats" }));

  expect(onChoose).toHaveBeenCalledWith({ tableId: "table-t2" });
});

test("within an area, tables come in the order of their names, numbers counted as numbers", () => {
  const table = (id: string, label: string) => ({
    id,
    label,
    zone: "INDOOR" as const,
    capacity: 4,
  });
  const [first] = loriSaturday.slots;
  if (!first) throw new Error("No sample time");
  const slot = { ...first, tables: [table("c", "T10"), table("b", "T2"), table("a", "T1")] };
  renderWidget({
    choices: { ...SATURDAY, time: slot.starts },
    availability: {
      data: { ...loriSaturday, slots: [slot] },
      failed: false,
      retrying: false,
      onRetry: vi.fn(),
    },
  });

  expect(screen.getAllByRole("radio").map((radio) => radio.closest("label")?.textContent)).toEqual([
    "T1 4 seats",
    "T2 4 seats",
    "T10 4 seats",
  ]);
});

test("a chosen table is said back, and booking sends the note, trimmed", async () => {
  const { onBook } = renderWidget({ choices: AT_T2 });

  expect(
    screen.getByText("A table for two on Saturday 14 November at 19:00, indoors."),
  ).toBeDefined();
  expect(screen.getByText("Table T2 · until 21:00")).toBeDefined();
  await userEvent.type(screen.getByLabelText("Special requests"), "  A window seat  ");
  await userEvent.click(screen.getByRole("button", { name: "Book this table" }));

  expect(onBook).toHaveBeenCalledWith("A window seat");
});

test("a table chosen earlier that isn't free any more says so above the tables, and can't be booked", () => {
  // T1 is booked at 19:00 in the demo.
  renderWidget({ choices: { ...AT_T2, tableId: "table-t1" } });

  expect(screen.getByRole("alert").textContent).toBe(
    "The table you chose isn’t free at 19:00 any more. Choose another.",
  );
  expect(screen.queryByRole("button", { name: "Book this table" })).toBeNull();
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

  expect(screen.getByRole("button", { name: "Book this table" }).getAttribute("aria-busy")).toBe(
    "true",
  );
});

test("signed out, the last step is a link to sign in that knows the way back", () => {
  const signIn = {
    from: { pathname: "/restaurants/lori-smokehouse", search: "?time=19:00", hash: "" },
  };
  renderWidget({ choices: AT_T2, viewer: { kind: "signedOut", signIn } });

  expect(screen.getByRole("link", { name: "Sign in to book" }).getAttribute("href")).toBe("/login");
  expect(screen.queryByRole("button", { name: "Book this table" })).toBeNull();
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
  expect(alert.nextElementSibling?.textContent).toBe("Book this table");
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

  await userEvent.click(screen.getByRole("button", { name: "Book another table" }));

  expect(onBookAnother).toHaveBeenCalledOnce();
});
