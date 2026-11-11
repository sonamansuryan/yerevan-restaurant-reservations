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

test("the tables are grouped by area, in a fixed order, each a line with the parties it takes", () => {
  renderList();

  expect(screen.getAllByRole("heading").map((heading) => heading.textContent)).toEqual([
    "Indoor",
    "Terrace",
    "VIP",
    "Bar counter",
  ]);
  expect(line("T4").textContent).toContain("3–6 guests");
  expect(line("Bar 1").textContent).toContain("1 guest");
});

test("an inactive table stays in its area, marked, and can be switched back on", async () => {
  const { onSwitch } = renderList();

  expect(within(line("T6")).getByText("Inactive")).toBeDefined();
  expect(within(line("T1")).queryByText("Inactive")).toBeNull();

  await userEvent.click(screen.getByRole("button", { name: "Activate T6" }));

  expect(onSwitch).toHaveBeenCalledWith(expect.objectContaining({ label: "T6", isActive: false }));
});

test("Edit and Deactivate name their table, for screen readers", async () => {
  const { onEdit, onSwitch } = renderList();

  await userEvent.click(screen.getByRole("button", { name: "Edit T4" }));
  await userEvent.click(screen.getByRole("button", { name: "Deactivate T1" }));

  expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ label: "T4" }));
  expect(onSwitch).toHaveBeenCalledWith(expect.objectContaining({ label: "T1", isActive: true }));
});

test("while its switch is sent, the table's button is busy", () => {
  renderList({ switchingId: "table-t1" });

  expect(screen.getByRole("button", { name: "Deactivate T1" }).getAttribute("aria-busy")).toBe(
    "true",
  );
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
