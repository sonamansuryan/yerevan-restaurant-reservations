import { describe, expect, test } from "vitest";

import { choicesFrom, choicesParams, coursesOf, readBack } from "@/features/booking/booking";
import { loriSaturday } from "@/features/design/samples";

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

describe("the booking said back", () => {
  test("names the party, the day, the time and where the table is", () => {
    expect(readBack(2, "2026-11-14", "19:00", "INDOOR", TODAY)).toBe(
      "A table for two on Saturday 14 November at 19:00, indoors.",
    );
    expect(readBack(1, "2026-11-14", "21:30", "BAR_COUNTER", TODAY)).toBe(
      "A table for one on Saturday 14 November at 21:30, at the bar.",
    );
    expect(readBack(12, "2026-11-14", "18:00", "TERRACE", TODAY)).toBe(
      "A table for 12 on Saturday 14 November at 18:00, on the terrace.",
    );
  });

  test("gives the year when it isn't this year", () => {
    expect(readBack(4, "2027-01-08", "20:00", "VIP", TODAY)).toBe(
      "A table for four on Friday 8 January 2027 at 20:00, in the VIP room.",
    );
  });
});
