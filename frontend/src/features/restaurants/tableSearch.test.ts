import { describe, expect, test } from "vitest";

import {
  CARD_TIMES,
  dayLink,
  defaultTime,
  freeTimeLink,
  nearestFreeTimes,
  readDate,
  readGuests,
  readTime,
  SEARCH_DAYS,
  SEARCH_TIMES,
  searchDays,
  tableQuery,
  USUAL_TIME,
  whenWords,
} from "@/features/restaurants/tableSearch";
import type { TableQuery } from "@/features/restaurants/tableSearch";
import type { Availability, AvailabilitySlot } from "@/types/api";

const TODAY = "2026-11-13";

/** A time on the day, with a table for the party, or none when every table is taken. */
const slot = (starts: string, free = true): AvailabilitySlot => ({
  startsAt: "2026-11-13T15:00:00.000Z",
  endsAt: "2026-11-13T17:00:00.000Z",
  starts,
  ends: starts,
  tables: free ? [{ id: "table-t1", label: "T1", zone: "INDOOR", capacity: 2 }] : [],
});

const day = (slots: AvailabilitySlot[]): Availability => ({
  date: TODAY,
  partySize: 2,
  bookingWindow: { first: TODAY, last: "2027-01-12" },
  slots,
});

/** A day whose times all have a table free. */
const freeAt = (...times: string[]): Availability => day(times.map((time) => slot(time)));

describe("what the search offers to choose", () => {
  test("the times are every half hour from 09:00 to 23:30", () => {
    const halfHours: string[] = [];
    for (let hour = 9; hour <= 23; hour += 1) {
      const hh = String(hour).padStart(2, "0");
      halfHours.push(`${hh}:00`, `${hh}:30`);
    }

    expect(SEARCH_TIMES).toEqual(halfHours);
    expect(SEARCH_TIMES[0]).toBe("09:00");
    expect(SEARCH_TIMES.at(-1)).toBe("23:30");
  });

  test("the days are today and the 60 after it, as far as booking can", () => {
    const days = searchDays(TODAY);

    expect(days).toHaveLength(61);
    expect(SEARCH_DAYS).toBe(61);
    expect(days.slice(0, 3)).toEqual(["2026-11-13", "2026-11-14", "2026-11-15"]);
    // They run on across the month's and the year's end.
    expect(days).toContain("2026-12-01");
    expect(days.at(-1)).toBe("2027-01-12");
  });
});

describe("the time a search starts at", () => {
  test("is 19:30 while that's an hour or more away", () => {
    expect(USUAL_TIME).toBe("19:30");
    expect(defaultTime("00:00")).toBe("19:30");
    expect(defaultTime("12:00")).toBe("19:30");
    // Exactly an hour before still leaves 19:30 to book.
    expect(defaultTime("18:30")).toBe("19:30");
  });

  test("is the first half hour at least an hour away once 19:30 is too soon", () => {
    expect(defaultTime("18:31")).toBe("20:00");
    expect(defaultTime("19:00")).toBe("20:00");
    expect(defaultTime("19:15")).toBe("20:30");
    expect(defaultTime("22:30")).toBe("23:30");
  });

  test("is 19:30 again late at night, when the next would be past 23:30", () => {
    expect(defaultTime("22:31")).toBe("19:30");
    expect(defaultTime("22:45")).toBe("19:30");
    expect(defaultTime("23:59")).toBe("19:30");
  });

  test("is always one of the times the search offers, at any minute of the day", () => {
    // The search's time select starts at it, so it has to be one of the select's options.
    for (let minute = 0; minute < 24 * 60; minute += 1) {
      // The minute as HH:MM, read off a UTC moment, which has no time zone to get in the way.
      const clock = new Date(minute * 60_000).toISOString().slice(11, 16);
      expect(SEARCH_TIMES, clock).toContain(defaultTime(clock));
    }
  });
});

describe("the search read from the address", () => {
  test("a party of 1 to 20 is read as a number", () => {
    expect(readGuests("1")).toBe(1);
    expect(readGuests("4")).toBe(4);
    expect(readGuests("20")).toBe(20);
  });

  test("any other party is left out", () => {
    for (const value of ["0", "21", "2.5", "-2", "two", ""]) {
      expect(readGuests(value), value).toBeUndefined();
    }
    expect(readGuests(null)).toBeUndefined();
  });

  test("a time is read only when it's one of the search's half hours", () => {
    expect(readTime("09:00")).toBe("09:00");
    expect(readTime("19:30")).toBe("19:30");
    expect(readTime("23:30")).toBe("23:30");
    for (const value of ["08:30", "19:15", "24:00", "9:00", "7pm", ""]) {
      expect(readTime(value), value).toBeUndefined();
    }
    expect(readTime(null)).toBeUndefined();
  });

  test("a date is read when it's a real one, even a past one, which the search replaces later", () => {
    expect(readDate("2026-11-14")).toBe("2026-11-14");
    expect(readDate("2020-01-01")).toBe("2020-01-01");
    for (const value of ["2026-02-30", "2026-13-01", "14/11/2026", "tomorrow", ""]) {
      expect(readDate(value), value).toBeUndefined();
    }
    expect(readDate(null)).toBeUndefined();
  });
});

describe("the search, filled in", () => {
  test("with nothing chosen, it's today, at the time for now, for two", () => {
    expect(tableQuery({}, TODAY, "12:00")).toEqual({ date: TODAY, time: "19:30", guests: 2 });
    expect(tableQuery({}, TODAY, "19:00")).toEqual({ date: TODAY, time: "20:00", guests: 2 });
  });

  test("what was chosen is kept", () => {
    const chosen: TableQuery = { date: "2026-11-20", time: "21:00", guests: 6 };

    expect(tableQuery(chosen, TODAY, "19:00")).toEqual(chosen);
  });

  test("anything not chosen is filled in beside what was", () => {
    expect(tableQuery({ guests: 4 }, TODAY, "12:00")).toEqual({
      date: TODAY,
      time: "19:30",
      guests: 4,
    });
    expect(tableQuery({ time: "13:00" }, TODAY, "12:00")).toEqual({
      date: TODAY,
      time: "13:00",
      guests: 2,
    });
  });

  test("a later day with no time starts at 19:30, whatever the time is now", () => {
    // Late on Friday evening, a search for Saturday still starts at the usual time: the hour
    // that can't be booked any more is today's alone.
    expect(tableQuery({ date: "2026-11-14" }, TODAY, "19:00")).toEqual({
      date: "2026-11-14",
      time: "19:30",
      guests: 2,
    });
    expect(tableQuery({ date: "2026-11-14" }, TODAY, "22:40").time).toBe("19:30");
    // Today's search still waits for the clock.
    expect(tableQuery({ date: TODAY }, TODAY, "19:00").time).toBe("20:00");
  });

  test("a day before today becomes today, and the rest is kept", () => {
    expect(tableQuery({ date: "2026-11-12", time: "20:00", guests: 3 }, TODAY, "12:00")).toEqual({
      date: TODAY,
      time: "20:00",
      guests: 3,
    });
  });

  test("today and the 60 days after it can be chosen, and no day after that", () => {
    expect(tableQuery({ date: TODAY }, TODAY, "12:00").date).toBe(TODAY);
    expect(tableQuery({ date: "2027-01-12" }, TODAY, "12:00").date).toBe("2027-01-12");
    expect(tableQuery({ date: "2027-01-13" }, TODAY, "12:00").date).toBe(TODAY);
  });
});

describe("a card's free times", () => {
  test("are the three nearest the time asked for", () => {
    const times = nearestFreeTimes(
      freeAt("12:00", "18:00", "18:30", "19:30", "20:00", "21:00", "22:00"),
      "19:30",
    );

    expect(times).toEqual(["18:30", "19:30", "20:00"]);
    expect(times).toHaveLength(CARD_TIMES);
  });

  test("leave out the times with no table for the party", () => {
    const times = nearestFreeTimes(
      day([
        slot("19:00", false),
        slot("19:30", false),
        slot("20:00"),
        slot("21:00"),
        slot("22:30"),
      ]),
      "19:30",
    );

    expect(times).toEqual(["20:00", "21:00", "22:30"]);
  });

  test("of two times as near, the earlier wins", () => {
    // 19:00 and 20:00 are both half an hour from 19:30, and 18:30 and 20:30 both an hour.
    const evening = freeAt("18:30", "19:00", "20:00", "20:30");

    expect(nearestFreeTimes(evening, "19:30", 1)).toEqual(["19:00"]);
    expect(nearestFreeTimes(evening, "19:30")).toEqual(["18:30", "19:00", "20:00"]);
  });

  test("come in the order of the day, not by how near they are", () => {
    // Nearest first, they would be 21:00, 20:30, then 22:00.
    expect(nearestFreeTimes(freeAt("17:00", "20:30", "21:00", "22:00", "23:00"), "21:00")).toEqual([
      "20:30",
      "21:00",
      "22:00",
    ]);
  });

  test("before the restaurant opens, they're its first times", () => {
    expect(nearestFreeTimes(freeAt("18:00", "18:30", "19:00", "19:30"), "09:00")).toEqual([
      "18:00",
      "18:30",
      "19:00",
    ]);
  });

  test("are as many as asked for, or as there are", () => {
    const evening = freeAt("18:00", "18:30", "19:00", "19:30", "20:00");

    expect(nearestFreeTimes(evening, "19:00", 1)).toEqual(["19:00"]);
    expect(nearestFreeTimes(evening, "19:00", 5)).toEqual([
      "18:00",
      "18:30",
      "19:00",
      "19:30",
      "20:00",
    ]);
    expect(nearestFreeTimes(freeAt("19:00", "20:00"), "19:30")).toEqual(["19:00", "20:00"]);
  });

  test("are none when no table is free", () => {
    expect(nearestFreeTimes(day([slot("19:00", false), slot("19:30", false)]), "19:30")).toEqual(
      [],
    );
    expect(nearestFreeTimes(day([]), "19:30")).toEqual([]);
  });
});

describe("where a card leads", () => {
  const query: TableQuery = { date: "2026-11-14", time: "19:30", guests: 4 };

  test("a time opens the restaurant's page with the booking at that time, day and party", () => {
    expect(freeTimeLink("lori-smokehouse", query, "20:00")).toEqual({
      pathname: "/restaurants/lori-smokehouse",
      search: "?date=2026-11-14&guests=4&time=20%3A00",
    });
  });

  test("its page keeps the day and party, and leaves the time to choose there", () => {
    expect(dayLink("lori-smokehouse", query)).toEqual({
      pathname: "/restaurants/lori-smokehouse",
      search: "?date=2026-11-14&guests=4",
    });
  });

  test("the times are today's, or another day's by its name", () => {
    expect(whenWords(TODAY, TODAY)).toBe("today");
    expect(whenWords("2026-11-14", TODAY)).toBe("on Saturday 14 November");
    expect(whenWords("2027-01-02", TODAY)).toBe("on Saturday 2 January 2027");
  });
});
