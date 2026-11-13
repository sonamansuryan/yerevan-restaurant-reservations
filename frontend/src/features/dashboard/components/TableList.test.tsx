// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, expect, test, vi } from "vitest";

import { TableList } from "@/features/dashboard/components/TableList";
import { fridayBookings, ownedTables } from "@/features/design/samples";
import { ApiError } from "@/lib/api";

afterEach(cleanup);

type Props = ComponentProps<typeof TableList>;

function renderList(props: Partial<Props> = {}): Props {
  const all: Props = { tables: ownedTables, onEdit: vi.fn(), onSwitch: vi.fn(), ...props };
  render(<TableList {...all} />);
  return all;
}

const line = (name: string): HTMLElement => {
  const item = screen.getByRole("button", { name: `Edit ${name}` }).closest("li");
  if (!item) throw new Error(`No line for ${name}`);
  return item;
};
const active = (name: string): HTMLInputElement =>
  screen.getByRole<HTMLInputElement>("checkbox", { name: `Active, ${name}` });

test("all the tables are in one list, by area in a fixed order, each with the parties it takes", () => {
  renderList();

  expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("All tables");
  // Each line is named by its Edit button, so these are the lines in order.
  expect(screen.getAllByRole("button", { name: /^Edit / }).map((edit) => edit.ariaLabel)).toEqual([
    "Edit T1",
    "Edit T2",
    "Edit T3",
    "Edit T5",
    "Edit T6",
    "Edit T4",
    "Edit The long table",
    "Edit Bar 1",
  ]);
  expect(within(line("T4")).getByText("Table T4 ·", { exact: false }).textContent).toBe(
    "Table T4 · 3–6 guests",
  );
  expect(within(line("T4")).getByText("Terrace")).toBeDefined();
  expect(line("Bar 1").textContent).toContain("1 guest");
  // The short name in the square is for the eye: the line says the whole name.
  expect(within(line("Bar 1")).getByText("B1").getAttribute("aria-hidden")).toBe("true");
});

test("a switched-off table stays in its area, marked, and can be switched back on", async () => {
  const { onSwitch } = renderList();

  expect(within(line("T6")).getByText("Indoor · switched off")).toBeDefined();
  expect(within(line("T1")).queryByText(/switched off/)).toBeNull();
  expect(active("T6").checked).toBe(false);
  expect(active("T1").checked).toBe(true);

  await userEvent.click(active("T6"));

  expect(onSwitch).toHaveBeenCalledWith(expect.objectContaining({ label: "T6", isActive: false }));
});

test("Edit and the Active switch name their table, for screen readers", async () => {
  const { onEdit, onSwitch } = renderList();

  await userEvent.click(screen.getByRole("button", { name: "Edit T4" }));
  await userEvent.click(active("T1"));

  expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ label: "T4" }));
  expect(onSwitch).toHaveBeenCalledWith(expect.objectContaining({ label: "T1", isActive: true }));
});

test("while its switch is sent, the table's switch waits, and the others can still be used", () => {
  renderList({ switchingId: "table-t1" });

  expect(active("T1").disabled).toBe(true);
  expect(active("T2").disabled).toBe(false);
});

test("a refused switch shows under its table's line, with the bookings in the way", () => {
  const atT1 = fridayBookings.filter((booking) => booking.table.label === "T1");
  const refused = new ApiError(
    409,
    "TABLE_HAS_BOOKINGS",
    "2 upcoming bookings still need this table. You can deactivate it once they're over or cancelled.",
    { reservations: atT1 },
  );

  renderList({ refusal: { tableId: "table-t1", error: refused } });

  const t1 = line("T1");
  expect(within(t1).getByRole("alert").textContent).toContain("2 upcoming bookings still need");
  const bookings = within(t1).getByRole("list", { name: "Bookings in the way" });
  expect(
    within(bookings)
      .getAllByRole("listitem")
      .map((item) => item.textContent),
  ).toEqual([
    "Friday 13 November, 12:30–14:30Lilit Harutyunyan · 2 guests · Table T1",
    "Friday 13 November, 22:30–00:30Գոհար Մկրտչյան · 2 guests · Table T1",
  ]);
  // Only that table's line says so.
  expect(within(line("T2")).queryByRole("alert")).toBeNull();
});
