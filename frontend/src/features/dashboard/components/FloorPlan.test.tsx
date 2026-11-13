// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { FloorPlan } from "@/features/dashboard/components/FloorPlan";
import type { TableNow } from "@/features/dashboard/tables";
import { ownedTables } from "@/features/design/samples";
import type { OwnerTable } from "@/types/api";

afterEach(cleanup);

// Lori Smokehouse's tables: T1 to T6 indoors (T6 switched off), T4 on the terrace, the long table
// in the VIP room, and one seat at the bar. Each kind of status shows on one of them.
const STATUSES: Record<string, TableNow> = {
  "table-t1": { kind: "free" },
  "table-t2": { kind: "reserved", at: "18:30" },
  "table-t3": { kind: "seated", until: "21:00" },
  "table-t5": { kind: "reserved", at: "19:30" },
  "table-t6": { kind: "off" },
  "table-t4": { kind: "blocked", until: "23:00" },
  "table-v1": { kind: "free" },
  "table-b1": { kind: "seated", until: "20:15" },
};

const statusFor = (table: OwnerTable): TableNow => STATUSES[table.id] ?? { kind: "free" };

/** The areas' names, in the order they show, each above its list of tables. */
const areaNames = (): string[] =>
  screen.getAllByRole("list").map((list) => list.previousElementSibling?.textContent ?? "");

test("the plan is headed Floor plan", () => {
  render(<FloorPlan tables={ownedTables} statusFor={statusFor} />);

  expect(screen.getByRole("heading", { level: 3, name: "Floor plan" })).toBeDefined();
});

test("each area with tables has its own place, in the Tables page's order", () => {
  render(<FloorPlan tables={ownedTables} statusFor={statusFor} />);

  expect(areaNames()).toEqual(["Indoor", "Terrace", "VIP", "Bar counter"]);
});

test("an area without tables isn't shown", () => {
  const indoorsAndBar = ownedTables.filter(
    ({ zone }) => zone === "INDOOR" || zone === "BAR_COUNTER",
  );
  render(<FloorPlan tables={indoorsAndBar} statusFor={statusFor} />);

  expect(areaNames()).toEqual(["Indoor", "Bar counter"]);
});

test("screen readers hear each table's seats and how it stands, in words", () => {
  render(<FloorPlan tables={ownedTables} statusFor={statusFor} />);

  const tables = screen.getAllByRole("listitem");
  const heard = (label: string, words: string): void => {
    const table = tables.find((item) => within(item).queryByText(label) !== null);
    if (!table) throw new Error(`No table ${label}`);
    expect(within(table).getByText(words).className).toContain("sr-only");
  };
  heard("T1", ", 4 seats, free now");
  heard("T2", ", 2 seats, reserved at 18:30");
  heard("T3", ", 4 seats, seated until 21:00");
  heard("T4", ", 6 seats, blocked until 23:00");
  heard("T6", ", 4 seats, switched off");
  heard("Bar 1", ", 1 seat, seated until 20:15");
});

test("the short words under each name are for the eye only", () => {
  render(<FloorPlan tables={ownedTables} statusFor={statusFor} />);

  for (const short of ["4 · free", "2 · 18:30", "4 · seated", "6 · blocked", "4 · off"]) {
    expect(screen.getByText(short).getAttribute("aria-hidden")).toBe("true");
  }
});

test("each table is asked how it stands, once", () => {
  const asked = vi.fn(statusFor);
  render(<FloorPlan tables={ownedTables} statusFor={asked} />);

  expect(asked.mock.calls.map(([table]) => table.id).sort()).toEqual(
    ownedTables.map(({ id }) => id).sort(),
  );
});

test("the legend is for the eye only, so screen readers hear each table's own words", () => {
  render(<FloorPlan tables={ownedTables} statusFor={statusFor} />);

  // Eight tables, and none of the legend's four.
  expect(screen.getAllByRole("listitem")).toHaveLength(8);
  expect(screen.getAllByRole("listitem", { hidden: true })).toHaveLength(12);
});
