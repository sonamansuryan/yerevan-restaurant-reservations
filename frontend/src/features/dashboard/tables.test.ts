import { describe, expect, test } from "vitest";

import {
  NEW_TABLE,
  guestRange,
  tableCode,
  tableFields,
  tableFormSchema,
  tableName,
  tableNow,
  tablesByZone,
  tablesSummary,
} from "@/features/dashboard/tables";
import { ownedTables } from "@/features/design/samples";
import type { OwnerBlock, OwnerReservation, OwnerTable, ReservationStatus } from "@/types/api";

describe("a table in words", () => {
  test("its name, without saying table twice", () => {
    expect(tableName("T4")).toBe("Table T4");
    expect(tableName("Terrace 2")).toBe("Table Terrace 2");
    expect(tableName("Table 1")).toBe("Table 1");
    expect(tableName("table by the window")).toBe("table by the window");
    // Only the whole word counts: "Tablet" is a name, not "table".
    expect(tableName("Tablet")).toBe("Table Tablet");
  });

  test("its code for its square: a short name as it is, a long one as its first letter and number", () => {
    expect(tableCode("T4")).toBe("T4");
    expect(tableCode("Bar1")).toBe("Bar1");
    expect(tableCode(" T12 ")).toBe("T12");
    expect(tableCode("Terrace 12")).toBe("T12");
    expect(tableCode("Bar 1")).toBe("B1");
    expect(tableCode("terrace 2")).toBe("T2");
    expect(tableCode("Window")).toBe("W");
    expect(tableCode("The long table")).toBe("T");
    // Four letters at most. A number too long isn't cut, which could name another table, such as
    // T123: the first letter stands alone, and the full name is beside the square.
    expect(tableCode("Table 12345")).toBe("T");
    expect(tableCode("Table 123")).toBe("T123");
    // Armenian letters have capitals too.
    expect(tableCode("պատշգամբ 3")).toBe("Պ3");
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

describe("how a table stands now, for the floor plan", () => {
  const FRIDAY = "2026-11-13";
  /** A moment on Friday 13 November at this time in Yerevan, which is 4 hours ahead of UTC. */
  const fridayAt = (time: string): string => {
    const [hour = 0, minute = 0] = time.split(":").map(Number);
    return new Date(Date.UTC(2026, 10, 13, hour - 4, minute)).toISOString();
  };
  const NOW = Date.parse(fridayAt("19:10"));

  const t1: OwnerTable = {
    id: "table-t1",
    label: "T1",
    capacity: 4,
    minCapacity: 2,
    zone: "INDOOR",
    isActive: true,
  };
  const atT1 = { id: t1.id, label: t1.label, zone: t1.zone };
  const atT4 = { id: "table-t4", label: "T4", zone: "TERRACE" } as const;

  /** A booking on Friday, from one time to another on Yerevan's clock, at T1 unless it says. */
  function booking(
    status: ReservationStatus,
    starts: string,
    ends: string,
    table: OwnerReservation["table"] = atT1,
  ): OwnerReservation {
    return {
      id: `booking-${starts}`,
      status,
      partySize: 2,
      startsAt: fridayAt(starts),
      endsAt: fridayAt(ends),
      starts,
      ends,
      table,
      guest: { name: "Lilit Harutyunyan" },
      specialRequests: null,
      cancellation: null,
      actions: [],
    };
  }

  /** A block on Friday, for one table or, with null, the whole restaurant. */
  function block(table: OwnerBlock["table"], starts: string, ends: string): OwnerBlock {
    return {
      id: `block-${starts}`,
      table,
      startsAt: fridayAt(starts),
      endsAt: fridayAt(ends),
      starts: { date: FRIDAY, time: starts },
      ends: { date: FRIDAY, time: ends },
      reason: null,
    };
  }

  test("a table switched off is off, whatever is booked or blocked", () => {
    const off = { ...t1, isActive: false };

    expect(
      tableNow(off, [booking("ARRIVED", "19:00", "21:00")], [block(null, "18:00", "23:00")], NOW),
    ).toEqual({ kind: "off" });
  });

  test("a block for the whole restaurant covering now blocks it, until the block ends", () => {
    expect(tableNow(t1, [], [block(null, "18:00", "23:00")], NOW)).toEqual({
      kind: "blocked",
      until: "23:00",
    });
  });

  test("a block for this table covering now blocks it", () => {
    expect(tableNow(t1, [], [block(atT1, "19:00", "20:30")], NOW)).toEqual({
      kind: "blocked",
      until: "20:30",
    });
  });

  test("a block for another table, or at another time, doesn't", () => {
    const blocks = [
      block(atT4, "18:00", "23:00"),
      block(null, "12:00", "15:00"),
      block(atT1, "21:00", "23:00"),
      // Over at this very minute.
      block(null, "18:00", "19:10"),
    ];

    expect(tableNow(t1, [], blocks, NOW)).toEqual({ kind: "free" });
  });

  test("a guest marked arrived is seated until their booking ends", () => {
    expect(tableNow(t1, [booking("ARRIVED", "18:30", "20:30")], [], NOW)).toEqual({
      kind: "seated",
      until: "20:30",
    });
    // From the minute the booking starts.
    expect(tableNow(t1, [booking("ARRIVED", "19:10", "21:10")], [], NOW)).toEqual({
      kind: "seated",
      until: "21:10",
    });
  });

  test("a confirmed booking whose time has come is still reserved until the guest is marked arrived", () => {
    expect(tableNow(t1, [booking("CONFIRMED", "19:00", "21:00")], [], NOW)).toEqual({
      kind: "reserved",
      at: "19:00",
    });
  });

  test("otherwise it's reserved by the next pending or confirmed booking, by when it starts", () => {
    const later = booking("CONFIRMED", "22:00", "23:59");
    const sooner = booking("PENDING", "20:30", "22:00");

    expect(tableNow(t1, [later, sooner], [], NOW)).toEqual({ kind: "reserved", at: "20:30" });
  });

  test("cancelled and no-show bookings, and those that are over, leave it free", () => {
    const bookings = [
      booking("CANCELLED", "19:00", "21:00"),
      booking("NO_SHOW", "18:00", "20:00"),
      booking("CONFIRMED", "12:00", "14:00"),
      booking("ARRIVED", "16:00", "18:00"),
      // Over at this very minute.
      booking("PENDING", "17:10", "19:10"),
    ];

    expect(tableNow(t1, bookings, [], NOW)).toEqual({ kind: "free" });
  });

  test("another table's bookings don't count", () => {
    const bookings = [
      booking("ARRIVED", "19:00", "21:00", atT4),
      booking("CONFIRMED", "20:00", "22:00", atT4),
    ];

    expect(tableNow(t1, bookings, [], NOW)).toEqual({ kind: "free" });
  });
});
