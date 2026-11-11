import { describe, expect, test } from "vitest";

import {
  NEW_TABLE,
  guestRange,
  tableFields,
  tableFormSchema,
  tableName,
  tablesByZone,
  tablesSummary,
} from "@/features/dashboard/tables";
import { ownedTables } from "@/features/design/samples";

describe("a table in words", () => {
  test("its name, without saying table twice", () => {
    expect(tableName("T4")).toBe("Table T4");
    expect(tableName("Terrace 2")).toBe("Table Terrace 2");
    expect(tableName("Table 1")).toBe("Table 1");
    expect(tableName("table by the window")).toBe("table by the window");
    // Only the whole word counts: "Tablet" is a name, not "table".
    expect(tableName("Tablet")).toBe("Table Tablet");
  });

  test("the parties it takes", () => {
    expect(guestRange({ minCapacity: 2, capacity: 4 })).toBe("2–4 guests");
    expect(guestRange({ minCapacity: 4, capacity: 4 })).toBe("4 guests");
    expect(guestRange({ minCapacity: 1, capacity: 1 })).toBe("1 guest");
  });

  test("the tables at a glance count only what can be booked", () => {
    // Seven active tables with 37 seats, and T6 switched off.
    expect(tablesSummary(ownedTables)).toBe("7 tables, 37 seats · 1 inactive");
    expect(tablesSummary(ownedTables.filter((table) => table.label === "Bar 1"))).toBe(
      "1 table, 1 seat",
    );
  });

  test("the tables by area, in a fixed order, each area as the tables were added", () => {
    expect(
      tablesByZone(ownedTables).map(({ zone, tables }) => [zone, tables.map((t) => t.label)]),
    ).toEqual([
      ["INDOOR", ["T1", "T2", "T3", "T5", "T6"]],
      ["TERRACE", ["T4"]],
      ["VIP", ["The long table"]],
      ["BAR_COUNTER", ["Bar 1"]],
    ]);
  });
});

describe("the table form", () => {
  test("sends seats as numbers, and the name trimmed", () => {
    expect(
      tableFormSchema.parse({ label: "  T7 ", capacity: "6", minCapacity: "3", zone: "TERRACE" }),
    ).toEqual({ label: "T7", capacity: 6, minCapacity: 3, zone: "TERRACE" });
  });

  test("a saved table fills the form, and comes back as it was", () => {
    const [t1] = ownedTables;
    if (!t1) throw new Error("No sample table");

    expect(tableFields(t1)).toEqual({
      label: "T1",
      capacity: "4",
      minCapacity: "2",
      zone: "INDOOR",
    });
    expect(tableFormSchema.parse(tableFields(t1))).toEqual({
      label: "T1",
      capacity: 4,
      minCapacity: 2,
      zone: "INDOOR",
    });
  });

  test("the server's rules, in the server's words", () => {
    const problems = (fields: typeof NEW_TABLE): Record<string, string> =>
      Object.fromEntries(
        (tableFormSchema.safeParse(fields).error?.issues ?? []).map((issue) => [
          String(issue.path[0]),
          issue.message,
        ]),
      );

    expect(problems({ ...NEW_TABLE, label: "   " })).toEqual({
      label: "Enter the table's name, such as T4.",
    });
    expect(problems({ ...NEW_TABLE, label: "T7", capacity: "2", minCapacity: "4" })).toEqual({
      minCapacity: "Use no more than the table's seats.",
    });
    expect(problems({ ...NEW_TABLE, label: "x".repeat(21) })).toEqual({
      label: "Use 20 characters or fewer.",
    });
  });
});
