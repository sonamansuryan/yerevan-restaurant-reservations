import { describe, expect, test } from "vitest";

import {
  bestFit,
  choicesFrom,
  choicesParams,
  coursesOf,
  DAYS_SHOWN,
  reserveLabel,
  rowStartFor,
} from "@/features/booking/booking";
import { loriSaturday } from "@/features/design/samples";
import type { AvailableTable } from "@/types/api";

const TODAY = "2026-11-13";

describe("the choices in the address", () => {
  test("are read as they were written", () => {
    const params = new URLSearchParams("date=2026-11-14&guests=4&time=19:00&table=table-t2");

    expect(choicesFrom(params, TODAY)).toEqual({
      date: "2026-11-14",
      guests: 4,
      time: "19:00",
      tableId: "table-t2",
    });
  });

  test("anything missing or malformed falls back to today, for two, with nothing chosen", () => {
    for (const query of [
      "",
      "date=2026-02-30&guests=0&time=7pm",
      "date=soon&guests=21",
      "guests=two",
    ]) {
      expect(choicesFrom(new URLSearchParams(query), TODAY), query).toEqual({
        date: TODAY,
        guests: 2,
        time: null,
        tableId: null,
      });
    }
  });

  test("are written back with a table only beside its time", () => {
    const choices = { date: "2026-11-14", guests: 2, time: null, tableId: "table-t2" };

    expect(choicesParams(choices).toString()).toBe("date=2026-11-14&guests=2");
    expect(choicesParams({ ...choices, time: "19:00" }).toString()).toBe(
      "date=2026-11-14&guests=2&time=19%3A00&table=table-t2",
    );
  });
});

describe("the day's times in courses", () => {
  test("lunch and dinner come apart where the kitchen closes", () => {
    const courses = coursesOf(loriSaturday.slots);

    expect(courses.map(({ name, slots }) => [name, slots.map(({ starts }) => starts)])).toEqual([
      ["Lunch", ["12:00", "12:30", "13:00"]],
      ["Dinner", ["18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"]],
    ]);
  });

  test("one service needs no name", () => {
    expect(coursesOf(loriSaturday.slots.slice(3)).map(({ name }) => name)).toEqual([null]);
  });
});

describe("the booking's button", () => {
  test("names the party, the day and the time", () => {
    expect(reserveLabel(2, "2026-11-13", "19:30")).toBe("Reserve for 2 · Fri 13 Nov, 19:30");
    expect(reserveLabel(1, "2027-01-02", "12:00")).toBe("Reserve for 1 · Sat 2 Jan, 12:00");
  });
});

describe("the table that fits best", () => {
  const table = (id: string, label: string, capacity: number): AvailableTable => ({
    id,
    label,
    zone: "INDOOR",
    capacity,
  });

  test("is the smallest free table, so bigger ones stay free for bigger parties", () => {
    expect(bestFit([table("t1", "T1", 4), table("p1", "P1", 6), table("t2", "T2", 2)])).toBe("t2");
  });

  test("of two the same size, the first by name, with numbers counted as numbers", () => {
    // By letters alone, T10 would come before T2.
    expect(bestFit([table("t10", "T10", 2), table("t2", "T2", 2)])).toBe("t2");
    expect(bestFit([table("t3", "T3", 2), table("bar", "Bar 1", 2)])).toBe("bar");
  });

  test("is none when no table is free", () => {
    expect(bestFit([])).toBeNull();
  });

  test("leaves the list in its order", () => {
    const tables = [table("t1", "T1", 4), table("t2", "T2", 2)];

    bestFit(tables);

    expect(tables.map(({ id }) => id)).toEqual(["t1", "t2"]);
  });
});

describe("the row of days", () => {
  test("starts today for today and the four days after it", () => {
    expect(DAYS_SHOWN).toBe(5);
    expect(rowStartFor(TODAY, TODAY)).toBe(TODAY);
    expect(rowStartFor("2026-11-17", TODAY)).toBe(TODAY);
  });

  test("the fifth day after today starts the next row, and so on, five days at a time", () => {
    expect(rowStartFor("2026-11-18", TODAY)).toBe("2026-11-18");
    expect(rowStartFor("2026-11-22", TODAY)).toBe("2026-11-18");
    expect(rowStartFor("2026-11-23", TODAY)).toBe("2026-11-23");
  });

  test("rows run on across the month's and the year's end", () => {
    // 22 days after today, so the row that starts 20 days after it.
    expect(rowStartFor("2026-12-05", TODAY)).toBe("2026-12-03");
    // The last day guests can book, 60 days after today, starts a row of its own.
    expect(rowStartFor("2027-01-12", TODAY)).toBe("2027-01-12");
    expect(rowStartFor("2027-01-11", TODAY)).toBe("2027-01-07");
  });

  test("a day before today shows in today's row", () => {
    expect(rowStartFor("2026-11-12", TODAY)).toBe(TODAY);
    expect(rowStartFor("2026-10-01", TODAY)).toBe(TODAY);
  });
});
