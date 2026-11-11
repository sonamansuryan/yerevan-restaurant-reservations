// The times a booking can start, and the tables free then (src/modules/availability/
// availability.rules.ts), with no database. The restaurants are the demo ones, with their hours
// and tables as seeded.
import { describe, expect, test } from "vitest";

import { RESTAURANTS, TIME_ZONE, openingHoursFor } from "../prisma/seed-data.ts";
import type { ReservationStatus } from "../src/generated/prisma/enums.ts";
import { addDays, dayOfWeek, localTimeToUtc } from "../src/lib/time.ts";
import {
  bookingWindow,
  findFreeTables,
  generateSlots,
  tableProblem,
} from "../src/modules/availability/availability.rules.ts";
import type {
  Slot,
  SlotSettings,
  TakenTimes,
  TimeRange,
  WantedBooking,
} from "../src/modules/availability/availability.rules.ts";
import { blockRange } from "../src/modules/blocks/blocks.rules.ts";
import { tableBlock } from "./fixtures/blocks.ts";
import { tableBooking } from "./fixtures/reservations.ts";
import { loriSlotSettings, sevanSlotSettings, tsiranSlotSettings } from "./fixtures/restaurants.ts";
import { loriTables, tsiranTables } from "./fixtures/tables.ts";

const YEREVAN = "Asia/Yerevan";
const MINUTE = 60_000;
// Wednesday 11 November 2026, 12:00 in Yerevan, which is four hours ahead of UTC.
const NOW = new Date("2026-11-11T08:00:00.000Z");
const MONDAY = "2026-11-16";
const THURSDAY = "2026-11-19";
const FRIDAY = "2026-11-20";
const SATURDAY = "2026-11-21";

const startTimes = (slots: Slot[]): string[] => slots.map((slot) => slot.starts);

describe("a normal day", () => {
  test("times run every interval from opening, while a booking would end by closing", () => {
    // Tsiran on a Thursday: 18:00 to 23:00, with 90-minute bookings every 30 minutes. 21:30 ends
    // at 23:00 exactly, and 22:00 would end at 23:30, after closing.
    expect(startTimes(generateSlots(tsiranSlotSettings(), THURSDAY, NOW))).toEqual([
      "18:00",
      "18:30",
      "19:00",
      "19:30",
      "20:00",
      "20:30",
      "21:00",
      "21:30",
    ]);
  });
});

describe("a closed day", () => {
  test("Tsiran is closed on Monday, so it offers no times", () => {
    expect(generateSlots(tsiranSlotSettings(), MONDAY, NOW)).toEqual([]);
  });

  test("nor does a restaurant with no opening hours at all", () => {
    expect(generateSlots(loriSlotSettings({ openingHours: [] }), FRIDAY, NOW)).toEqual([]);
  });
});

describe("two shifts", () => {
  test("Lori's lunch and dinner each offer their own times, with none in between", () => {
    expect(startTimes(generateSlots(loriSlotSettings(), FRIDAY, NOW))).toEqual([
      "12:00",
      "12:30",
      "13:00",
      "18:00",
      "18:30",
      "19:00",
      "19:30",
      "20:00",
      "20:30",
      "21:00",
    ]);
  });

  test("a booking stays inside its shift: lunch's last one ends as lunch closes at 15:00", () => {
    const lunch = generateSlots(loriSlotSettings(), FRIDAY, NOW).filter(
      (slot) => slot.starts < "15:00",
    );

    expect(lunch.at(-1)).toEqual({
      starts: "13:00",
      startsAt: new Date("2026-11-20T09:00:00.000Z"),
      endsAt: new Date("2026-11-20T11:00:00.000Z"), // 15:00 in Yerevan
    });
  });

  test("shifts come out in time order, whatever order the hours are stored in", () => {
    const lori = loriSlotSettings();
    const reversed = loriSlotSettings({ openingHours: [...lori.openingHours].reverse() });

    expect(startTimes(generateSlots(reversed, FRIDAY, NOW))).toEqual(
      startTimes(generateSlots(lori, FRIDAY, NOW)),
    );
  });
});

describe("a late closing", () => {
  test("Tsiran's Friday runs to 02:00, so its last booking starts at 23:30 and ends at 01:00", () => {
    const slots = generateSlots(tsiranSlotSettings(), FRIDAY, NOW);

    expect(startTimes(slots)).toEqual([
      "18:00",
      "18:30",
      "19:00",
      "19:30",
      "20:00",
      "20:30",
      "21:00",
      "21:30",
      "22:00",
      "22:30",
      "23:00",
      "23:30",
    ]);
    expect(slots.at(-1)?.endsAt).toEqual(new Date("2026-11-20T21:00:00.000Z")); // Saturday 01:00
  });

  test("no booking starts at midnight or later, though 00:00 would still end by 02:00", () => {
    const midnight = new Date("2026-11-20T20:00:00.000Z"); // Saturday 00:00 in Yerevan

    for (const slot of generateSlots(tsiranSlotSettings(), FRIDAY, NOW)) {
      expect(slot.startsAt < midnight, slot.starts).toBe(true);
    }
  });

  test("Friday's hours past midnight belong to Friday, so Saturday's times start at 18:00", () => {
    expect(generateSlots(tsiranSlotSettings(), SATURDAY, NOW)[0]?.starts).toBe("18:00");
  });

  test("hours that end at midnight end the last booking there", () => {
    const untilMidnight = loriSlotSettings({
      openingHours: [{ dayOfWeek: 5, opensAt: 1080, closesAt: 1440 }],
    });

    expect(generateSlots(untilMidnight, FRIDAY, NOW).at(-1)).toEqual({
      starts: "22:00",
      startsAt: new Date("2026-11-20T18:00:00.000Z"),
      endsAt: new Date("2026-11-20T20:00:00.000Z"), // Saturday 00:00
    });
  });
});

describe("closing time", () => {
  test("times stay on their steps from opening, so closing at 22:45 makes 20:30 the last", () => {
    // 20:30 ends at 22:30. 21:00 would end at 23:00, and 20:45 isn't a step from 18:00.
    const closesAt2245 = loriSlotSettings({
      openingHours: [{ dayOfWeek: 5, opensAt: 1080, closesAt: 1365 }],
    });

    expect(startTimes(generateSlots(closesAt2245, FRIDAY, NOW)).at(-1)).toBe("20:30");
  });

  test("hours shorter than a booking offer nothing, and hours a booking long offer one time", () => {
    const shorter = loriSlotSettings({
      openingHours: [{ dayOfWeek: 5, opensAt: 720, closesAt: 810 }], // 12:00–13:30
    });
    const exactly = loriSlotSettings({
      openingHours: [{ dayOfWeek: 5, opensAt: 720, closesAt: 840 }], // 12:00–14:00
    });

    expect(generateSlots(shorter, FRIDAY, NOW)).toEqual([]);
    expect(startTimes(generateSlots(exactly, FRIDAY, NOW))).toEqual(["12:00"]);
  });
});

describe("the slot interval", () => {
  test("Sevan and Salt offers a time every 15 minutes", () => {
    const times = startTimes(generateSlots(sevanSlotSettings(), FRIDAY, NOW));

    expect(times.slice(0, 4)).toEqual(["13:00", "13:15", "13:30", "13:45"]);
    // 13:00 to 22:00 with 90-minute bookings: 31 times, the last ending as it closes.
    expect(times.at(-1)).toBe("20:30");
    expect(times).toHaveLength(31);
  });

  test("steps count from opening, not from the hour", () => {
    const quarterPast = loriSlotSettings({
      openingHours: [{ dayOfWeek: 5, opensAt: 735, closesAt: 900 }], // 12:15–15:00
    });

    expect(startTimes(generateSlots(quarterPast, FRIDAY, NOW))).toEqual(["12:15", "12:45"]);
  });
});

describe("the booking length", () => {
  test("every booking lasts the restaurant's booking length", () => {
    for (const slot of generateSlots(loriSlotSettings(), FRIDAY, NOW)) {
      expect(slot.endsAt.getTime() - slot.startsAt.getTime(), slot.starts).toBe(120 * MINUTE);
    }
  });

  test("shorter bookings can start later: with 90 minutes, Lori's last times are 13:30 and 21:30", () => {
    const ninetyMinutes = loriSlotSettings({ reservationDurationMin: 90 });

    expect(startTimes(generateSlots(ninetyMinutes, FRIDAY, NOW))).toEqual([
      "12:00",
      "12:30",
      "13:00",
      "13:30",
      "18:00",
      "18:30",
      "19:00",
      "19:30",
      "20:00",
      "20:30",
      "21:00",
      "21:30",
    ]);
  });
});

describe("the 1-hour minimum", () => {
  test("a time exactly an hour away can be booked", () => {
    const at1100 = new Date("2026-11-20T07:00:00.000Z"); // Friday 11:00 in Yerevan

    expect(generateSlots(loriSlotSettings(), FRIDAY, at1100)[0]?.starts).toBe("12:00");
  });

  test("a minute later it can't, so the next time is the first", () => {
    const at1101 = new Date("2026-11-20T07:01:00.000Z"); // Friday 11:01 in Yerevan

    expect(generateSlots(loriSlotSettings(), FRIDAY, at1101)[0]?.starts).toBe("12:30");
  });

  test("times already past are never offered: at 14:00, only dinner is left", () => {
    const at1400 = new Date("2026-11-20T10:00:00.000Z"); // Friday 14:00 in Yerevan

    expect(startTimes(generateSlots(loriSlotSettings(), FRIDAY, at1400))).toEqual([
      "18:00",
      "18:30",
      "19:00",
      "19:30",
      "20:00",
      "20:30",
      "21:00",
    ]);
  });
});

describe("the 60-day limit", () => {
  test("guests can book from today to 60 days later", () => {
    expect(bookingWindow(NOW, YEREVAN)).toEqual({ first: "2026-11-11", last: "2027-01-10" });
  });

  test("the 60th day is offered in full, and the 61st not at all", () => {
    expect(generateSlots(loriSlotSettings(), "2027-01-10", NOW)).toHaveLength(10);
    expect(generateSlots(loriSlotSettings(), "2027-01-11", NOW)).toEqual([]);
  });

  test("a date already past offers nothing", () => {
    expect(generateSlots(loriSlotSettings(), "2026-11-10", NOW)).toEqual([]);
  });

  test("days count on the restaurant's calendar, not UTC's", () => {
    // 01:00 on Saturday 14 November in Yerevan, while it's still Friday the 13th in UTC.
    const saturdayInYerevan = new Date("2026-11-13T21:00:00.000Z");

    expect(bookingWindow(saturdayInYerevan, YEREVAN)).toEqual({
      first: "2026-11-14",
      last: "2027-01-13",
    });
    expect(generateSlots(loriSlotSettings(), "2027-01-13", saturdayInYerevan)).toHaveLength(10);
  });
});

describe("the restaurant's time zone", () => {
  test("each time is an exact moment on the restaurant's clock: 18:00 in Yerevan is 14:00 UTC", () => {
    expect(generateSlots(tsiranSlotSettings(), THURSDAY, NOW)[0]).toEqual({
      starts: "18:00",
      startsAt: new Date("2026-11-19T14:00:00.000Z"),
      endsAt: new Date("2026-11-19T15:30:00.000Z"),
    });
  });

  test("nothing assumes Yerevan's offset: the hour New York's clocks skip offers no times", () => {
    // On Sunday 8 March 2026 New York's clocks jump from 02:00 to 03:00, so 02:00 and 02:30
    // never happen. Each would otherwise come out as a moment that 03:00 or 03:30 already is.
    const nightBar: SlotSettings = {
      timezone: "America/New_York",
      slotIntervalMin: 30,
      reservationDurationMin: 60,
      openingHours: [{ dayOfWeek: 0, opensAt: 0, closesAt: 240 }], // Sunday 00:00–04:00
    };
    const weekBefore = new Date("2026-03-01T17:00:00.000Z"); // noon in New York

    const slots = generateSlots(nightBar, "2026-03-08", weekBefore);

    expect(startTimes(slots)).toEqual(["00:00", "00:30", "01:00", "01:30", "03:00"]);
    expect(slots.at(-1)).toEqual({
      starts: "03:00",
      startsAt: new Date("2026-03-08T07:00:00.000Z"),
      endsAt: new Date("2026-03-08T08:00:00.000Z"), // 04:00, closing
    });
  });
});

describe("what it refuses", () => {
  test("an interval that isn't a whole number of minutes above 0, rather than loop forever", () => {
    for (const slotIntervalMin of [0, -30, 7.5]) {
      expect(() => generateSlots(loriSlotSettings({ slotIntervalMin }), FRIDAY, NOW)).toThrow(
        "slot interval",
      );
    }
  });

  test("a date that isn't written YYYY-MM-DD", () => {
    expect(() => generateSlots(loriSlotSettings(), "20/11/2026", NOW)).toThrow("YYYY-MM-DD");
  });
});

describe("every time offered can be booked", () => {
  test("for every demo restaurant on every day of a week, each time keeps every rule", () => {
    const earliest = NOW.getTime() + 60 * MINUTE;
    let checked = 0;

    for (const seeded of RESTAURANTS) {
      const restaurant: SlotSettings = {
        timezone: TIME_ZONE,
        slotIntervalMin: seeded.slotIntervalMin,
        reservationDurationMin: seeded.reservationDurationMin,
        openingHours: openingHoursFor(seeded),
      };
      for (let day = 0; day < 7; day += 1) {
        const date = addDays(FRIDAY, day);
        for (const slot of generateSlots(restaurant, date, NOW)) {
          const where = `${seeded.slug}, ${date} ${slot.starts}`;
          const minutes = Number(slot.starts.slice(0, 2)) * 60 + Number(slot.starts.slice(3));
          // It starts inside one of that day's openings, on one of its steps, before midnight.
          const opening = restaurant.openingHours.find(
            (hours) =>
              hours.dayOfWeek === dayOfWeek(date) &&
              hours.opensAt <= minutes &&
              minutes < hours.closesAt,
          );
          if (!opening) throw new Error(`No opening for ${where}`);
          expect((minutes - opening.opensAt) % restaurant.slotIntervalMin, where).toBe(0);
          expect(slot.startsAt, where).toEqual(localTimeToUtc(date, minutes, TIME_ZONE));
          // It lasts the booking length, ends by closing, and is at least an hour away.
          expect(slot.endsAt.getTime() - slot.startsAt.getTime(), where).toBe(
            restaurant.reservationDurationMin * MINUTE,
          );
          expect(slot.endsAt <= localTimeToUtc(date, opening.closesAt, TIME_ZONE), where).toBe(
            true,
          );
          expect(slot.startsAt.getTime() >= earliest, where).toBe(true);
          checked += 1;
        }
      }
    }

    // So the loops can't pass by checking nothing.
    expect(checked).toBeGreaterThan(0);
  });
});

// The tables free for a booking. Each one is checked at a time generateSlots offers, as the
// availability page and booking will check them.
describe("findFreeTables", () => {
  const NOTHING_TAKEN: TakenTimes = { reservations: [], blocks: [] };
  // The demo's Saturday at Lori Smokehouse, when T1 is booked at 12:30 and at 19:00.
  const LORI_SATURDAY = "2026-11-14";
  const lori = loriTables();
  const tsiran = tsiranTables();

  const labels = (tables: readonly { label: string }[]): string[] =>
    tables.map((table) => table.label);
  const plusMinutes = (moment: Date, minutes: number): Date =>
    new Date(moment.getTime() + minutes * MINUTE);
  const partyOf = (partySize: number, time: TimeRange): WantedBooking => ({
    partySize,
    startsAt: time.startsAt,
    endsAt: time.endsAt,
  });
  const booked = (...reservations: TakenTimes["reservations"]): TakenTimes => ({
    reservations,
    blocks: [],
  });
  const blocked = (...blocks: TakenTimes["blocks"]): TakenTimes => ({ reservations: [], blocks });

  function tableNamed<Table extends { label: string }>(
    tables: readonly Table[],
    label: string,
  ): Table {
    const table = tables.find((candidate) => candidate.label === label);
    if (!table) throw new Error(`No table ${label}`);
    return table;
  }

  /** One of a restaurant's start times on a date, as generateSlots offers it. */
  function slotAt(restaurant: SlotSettings, date: string, starts: string): Slot {
    const slot = generateSlots(restaurant, date, NOW).find((offered) => offered.starts === starts);
    if (!slot) throw new Error(`${starts} isn't offered on ${date}`);
    return slot;
  }

  const loriAt = (starts: string): Slot => slotAt(loriSlotSettings(), LORI_SATURDAY, starts);
  const tsiranFridayAt = (starts: string): Slot => slotAt(tsiranSlotSettings(), FRIDAY, starts);
  const loriT1 = tableNamed(lori, "T1");

  describe("party size", () => {
    test("a table takes parties from its fewest guests up to its seats", () => {
      // At Lori, T1, T2, T3 and P1 take 2 to 4 guests, T4 takes 3 to 6, and T5 takes 4 to 8.
      const freeFor = (partySize: number): string[] =>
        labels(findFreeTables(lori, partyOf(partySize, loriAt("19:00")), NOTHING_TAKEN));

      expect(freeFor(2)).toEqual(["T1", "T2", "T3", "P1"]);
      expect(freeFor(3)).toEqual(["T1", "T2", "T3", "T4", "P1"]);
      expect(freeFor(4)).toEqual(["T1", "T2", "T3", "T4", "T5", "P1"]);
      expect(freeFor(5)).toEqual(["T4", "T5"]);
      expect(freeFor(6)).toEqual(["T4", "T5"]);
      expect(freeFor(7)).toEqual(["T5"]);
      expect(freeFor(8)).toEqual(["T5"]);
      expect(freeFor(9)).toEqual([]);
    });

    test("a guest on their own fits Tsiran's bar and its small table, but nothing at Lori", () => {
      const tsiranForOne = findFreeTables(
        tsiran,
        partyOf(1, tsiranFridayAt("19:00")),
        NOTHING_TAKEN,
      );

      expect(labels(tsiranForOne)).toEqual(["B1", "B2", "T1"]);
      expect(findFreeTables(lori, partyOf(1, loriAt("19:00")), NOTHING_TAKEN)).toEqual([]);
    });

    test("tableProblem says which way a table doesn't fit: Lori's T5 takes 4 to 8", () => {
      const t5 = tableNamed(lori, "T5");

      expect(tableProblem(t5, partyOf(9, loriAt("19:00")), NOTHING_TAKEN)).toBe("TOO_SMALL");
      expect(tableProblem(t5, partyOf(3, loriAt("19:00")), NOTHING_TAKEN)).toBe("TOO_BIG");
      expect(tableProblem(t5, partyOf(4, loriAt("19:00")), NOTHING_TAKEN)).toBeNull();
      expect(tableProblem(t5, partyOf(8, loriAt("19:00")), NOTHING_TAKEN)).toBeNull();
    });
  });

  describe("inactive tables", () => {
    test("a table the owner switched off is never offered, even with nothing booked", () => {
      const t2Off = lori.map((table) =>
        table.label === "T2" ? { ...table, isActive: false } : table,
      );
      const forTwo = partyOf(2, loriAt("19:00"));

      expect(labels(findFreeTables(t2Off, forTwo, NOTHING_TAKEN))).toEqual(["T1", "T3", "P1"]);
      expect(tableProblem(tableNamed(t2Off, "T2"), forTwo, NOTHING_TAKEN)).toBe("INACTIVE");
    });
  });

  describe("bookings", () => {
    // Lilit's demo booking: Lori's T1 from 19:00 to 21:00.
    const lilit = tableBooking();

    test("a booked table isn't free then, and the others still are", () => {
      const forTwo = partyOf(2, loriAt("19:00"));

      expect(labels(findFreeTables(lori, forTwo, booked(lilit)))).toEqual(["T2", "T3", "P1"]);
      expect(tableProblem(loriT1, forTwo, booked(lilit))).toBe("BOOKED");
    });

    test("a booking holds its table for its whole length: T1 is taken from 18:00 to 20:30", () => {
      // 18:00 would run until 20:00, an hour into Lilit's booking.
      for (const starts of ["18:00", "18:30", "19:00", "19:30", "20:00", "20:30"]) {
        expect(tableProblem(loriT1, partyOf(2, loriAt(starts)), booked(lilit)), starts).toBe(
          "BOOKED",
        );
      }
    });

    test("pending, confirmed and arrived bookings hold the table; cancelled and no-show ones free it", () => {
      const forTwo = partyOf(2, loriAt("19:00"));
      const problemWhen = (status: ReservationStatus): string | null =>
        tableProblem(loriT1, forTwo, booked(tableBooking({ status })));

      expect(problemWhen("PENDING")).toBe("BOOKED");
      expect(problemWhen("CONFIRMED")).toBe("BOOKED");
      expect(problemWhen("ARRIVED")).toBe("BOOKED");
      expect(problemWhen("CANCELLED")).toBeNull();
      expect(problemWhen("NO_SHOW")).toBeNull();
    });
  });

  describe("back-to-back bookings", () => {
    test("a booking can start as another ends: after Lilit's 19:00 to 21:00, T1 is free at 21:00", () => {
      expect(tableProblem(loriT1, partyOf(2, loriAt("21:00")), booked(tableBooking()))).toBeNull();
    });

    test("and end as another starts: with T1 booked from 20:00, it's free at 18:00", () => {
      const at20 = loriAt("20:00");
      const from20 = tableBooking({ startsAt: at20.startsAt, endsAt: at20.endsAt });

      expect(tableProblem(loriT1, partyOf(2, loriAt("18:00")), booked(from20))).toBeNull();
    });

    test("one minute more at either end is an overlap", () => {
      const at18 = loriAt("18:00"); // 18:00 to 20:00
      const at21 = loriAt("21:00"); // 21:00 to 23:00
      const untilOneMinutePast21 = tableBooking({ endsAt: plusMinutes(at21.startsAt, 1) });
      const fromOneMinuteTo20 = tableBooking({
        startsAt: plusMinutes(at18.endsAt, -1),
        endsAt: plusMinutes(at18.endsAt, 119),
      });

      expect(tableProblem(loriT1, partyOf(2, at21), booked(untilOneMinutePast21))).toBe("BOOKED");
      expect(tableProblem(loriT1, partyOf(2, at18), booked(fromOneMinuteTo20))).toBe("BOOKED");
    });
  });

  describe("blocks", () => {
    test("a block on one table takes only that table: Lori's T1, blocked for Saturday lunch", () => {
      // From 12:00 to 15:00, for a wobbly leg.
      const lunch = partyOf(2, loriAt("12:30"));

      expect(labels(findFreeTables(lori, lunch, blocked(tableBlock())))).toEqual([
        "T2",
        "T3",
        "P1",
      ]);
      expect(tableProblem(loriT1, lunch, blocked(tableBlock()))).toBe("BLOCKED");
      expect(tableProblem(loriT1, partyOf(2, loriAt("18:00")), blocked(tableBlock()))).toBeNull();
    });

    test("a block with no table takes every table: Tsiran's private evening", () => {
      const privateEvent = {
        tableId: null,
        ...blockRange({ from: "2026-11-20T18:00", to: "2026-11-21T02:00" }, YEREVAN),
      };

      for (const slot of generateSlots(tsiranSlotSettings(), FRIDAY, NOW)) {
        for (const partySize of [1, 2, 4, 6]) {
          const free = findFreeTables(tsiran, partyOf(partySize, slot), blocked(privateEvent));
          expect(free, `${slot.starts}, ${partySize} guests`).toEqual([]);
        }
      }
    });

    test("a block that ends as the booking starts, or starts as it ends, takes nothing", () => {
      const at19 = loriAt("19:00"); // 19:00 to 21:00
      const until19 = tableBlock({
        startsAt: plusMinutes(at19.startsAt, -60),
        endsAt: at19.startsAt,
      });
      const from21 = tableBlock({ startsAt: at19.endsAt, endsAt: plusMinutes(at19.endsAt, 60) });
      const untilOneMinutePast19 = tableBlock({
        startsAt: plusMinutes(at19.startsAt, -60),
        endsAt: plusMinutes(at19.startsAt, 1),
      });

      expect(tableProblem(loriT1, partyOf(2, at19), blocked(until19, from21))).toBeNull();
      expect(tableProblem(loriT1, partyOf(2, at19), blocked(untilOneMinutePast19))).toBe("BLOCKED");
    });
  });

  describe("past midnight", () => {
    // Tsiran's demo booking as it will be seeded: T2 from Friday 23:30 to Saturday 01:00.
    const at2330 = tsiranFridayAt("23:30");
    const lateBooking = tableBooking({
      tableId: tableNamed(tsiran, "T2").id,
      startsAt: at2330.startsAt,
      endsAt: at2330.endsAt,
    });

    test("a booking past midnight holds its table until it ends: T2 is taken at 23:00, free at 22:00", () => {
      // A party of 3 fits T2 (2 to 4 guests) and T3 (3 to 6). 23:00 would run until 00:30, and
      // 22:00 ends at 23:30, as the late booking starts.
      const forThreeAt = (starts: string): string[] =>
        labels(findFreeTables(tsiran, partyOf(3, tsiranFridayAt(starts)), booked(lateBooking)));

      expect(forThreeAt("23:00")).toEqual(["T3"]);
      expect(forThreeAt("22:00")).toEqual(["T2", "T3"]);
    });

    test("blocking Saturday as a whole day also takes Friday's bookings that run into it", () => {
      // From Saturday's midnight to Sunday's, the whole restaurant.
      const saturday = { tableId: null, ...blockRange({ date: SATURDAY }, YEREVAN) };
      const forTwoAt = (starts: string): string[] =>
        labels(findFreeTables(tsiran, partyOf(2, tsiranFridayAt(starts)), blocked(saturday)));

      // 22:30 ends at midnight, as the block starts. 23:00 and 23:30 run into Saturday.
      expect(forTwoAt("22:30")).toEqual(["B1", "B2", "T1", "T2"]);
      expect(forTwoAt("23:00")).toEqual([]);
      expect(forTwoAt("23:30")).toEqual([]);
    });
  });

  describe("with generateSlots", () => {
    test("on Lori's demo Saturday, T1 is free for two only at 21:00", () => {
      // Aram has T1 from 12:30 to 14:30, and Lilit from 19:00 to 21:00.
      const at1230 = loriAt("12:30");
      const aram = tableBooking({ startsAt: at1230.startsAt, endsAt: at1230.endsAt });
      const taken = booked(aram, tableBooking());

      const day = generateSlots(loriSlotSettings(), LORI_SATURDAY, NOW).map(
        (slot) =>
          `${slot.starts} ${labels(findFreeTables(lori, partyOf(2, slot), taken)).join(" ")}`,
      );

      expect(day).toEqual([
        "12:00 T2 T3 P1",
        "12:30 T2 T3 P1",
        "13:00 T2 T3 P1",
        "18:00 T2 T3 P1",
        "18:30 T2 T3 P1",
        "19:00 T2 T3 P1",
        "19:30 T2 T3 P1",
        "20:00 T2 T3 P1",
        "20:30 T2 T3 P1",
        "21:00 T1 T2 T3 P1",
      ]);
    });
  });

  describe("what comes back", () => {
    test("the free tables themselves, in the order they were given", () => {
      const reversed = [...lori].reverse();
      const free = findFreeTables(reversed, partyOf(2, loriAt("19:00")), NOTHING_TAKEN);

      expect(labels(free)).toEqual(["P1", "T3", "T2", "T1"]);
      expect(free[0]).toBe(reversed[0]); // the same object, with its name and area
    });

    test("a table with several problems gives the first, in the assignment's order", () => {
      const at19 = loriAt("19:00");
      const blockAt19 = tableBlock({ startsAt: at19.startsAt, endsAt: at19.endsAt });
      const both: TakenTimes = { reservations: [tableBooking()], blocks: [blockAt19] };

      // Switched off before too small, too small before booked, and booked before blocked.
      expect(tableProblem({ ...loriT1, isActive: false }, partyOf(9, at19), both)).toBe("INACTIVE");
      expect(tableProblem(loriT1, partyOf(9, at19), both)).toBe("TOO_SMALL");
      expect(tableProblem(loriT1, partyOf(2, at19), both)).toBe("BOOKED");
      expect(tableProblem(loriT1, partyOf(2, at19), blocked(blockAt19))).toBe("BLOCKED");
    });
  });
});
