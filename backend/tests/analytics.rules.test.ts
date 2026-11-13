// The counting behind Seghan's analytics (src/modules/analytics/analytics.rules.ts, task 9.6): which
// days are counted, and what their bookings add up to. tests/db/analytics.test.ts counts real rows.
import { describe, expect, test } from "vitest";

import type { ReservationStatus } from "../src/generated/prisma/enums.ts";
import {
  analyticsPeriod,
  countBookings,
  mostBooked,
} from "../src/modules/analytics/analytics.rules.ts";
import type { CountedBooking } from "../src/modules/analytics/analytics.rules.ts";

const YEREVAN = "Asia/Yerevan";
// Midday on Thursday 12 November 2026 in Yerevan, four hours ahead of UTC.
const NOW = new Date("2026-11-12T08:00:00.000Z");

const booking = (
  status: ReservationStatus,
  partySize = 2,
  rating: number | null = null,
): CountedBooking => ({ status, partySize, rating });

describe("analyticsPeriod", () => {
  test("the last 30 days are today and the 29 before it, as whole days in Yerevan", () => {
    expect(analyticsPeriod(30, NOW, YEREVAN)).toEqual({
      days: 30,
      from: "2026-10-14",
      to: "2026-11-12",
      // Yerevan's midnights, at 20:00 UTC the evening before.
      start: new Date("2026-10-13T20:00:00.000Z"),
      end: new Date("2026-11-12T20:00:00.000Z"),
    });
  });

  test.each([
    [7, "2026-11-06"],
    [90, "2026-08-15"],
  ] as const)("the last %i days start on %s", (days, from) => {
    expect(analyticsPeriod(days, NOW, YEREVAN)).toMatchObject({ from, to: "2026-11-12" });
  });

  test("after midnight in Yerevan it's already the next day there, though not yet in UTC", () => {
    const lateNight = new Date("2026-11-12T21:30:00.000Z");

    expect(analyticsPeriod(7, lateNight, YEREVAN)).toMatchObject({
      from: "2026-11-07",
      to: "2026-11-13",
      end: new Date("2026-11-13T20:00:00.000Z"),
    });
  });

  test("the days are the calendar's own, so a day the clocks change keeps its true length", () => {
    // Paris leaves summer time on 25 October 2026, so the first midnight is two hours ahead of
    // UTC and the last only one. Thirty times 24 hours would end an hour off.
    const period = analyticsPeriod(30, NOW, "Europe/Paris");

    expect(period.start).toEqual(new Date("2026-10-13T22:00:00.000Z"));
    expect(period.end).toEqual(new Date("2026-11-12T23:00:00.000Z"));
  });
});

describe("countBookings", () => {
  test("every booking counts once under its status, and every status is listed", () => {
    const numbers = countBookings([
      booking("PENDING"),
      booking("CONFIRMED"),
      booking("CONFIRMED"),
      booking("ARRIVED"),
      booking("NO_SHOW"),
      booking("CANCELLED"),
      booking("CANCELLED"),
      booking("CANCELLED"),
    ]);

    expect(numbers.bookings).toBe(8);
    expect(numbers.statuses).toEqual({
      PENDING: 1,
      CONFIRMED: 2,
      ARRIVED: 1,
      NO_SHOW: 1,
      CANCELLED: 3,
    });
  });

  test("guests are the people in the bookings marked arrived, and nobody else", () => {
    const numbers = countBookings([
      booking("ARRIVED", 4),
      booking("ARRIVED", 2),
      booking("NO_SHOW", 6),
      booking("CANCELLED", 8),
      booking("PENDING", 3),
      booking("CONFIRMED", 5),
    ]);

    expect(numbers.guests).toBe(6);
  });

  test("the ratings are the bookings' reviews: how many, their average, and each rating's count", () => {
    const numbers = countBookings([
      booking("ARRIVED", 2, 5),
      booking("ARRIVED", 2, 5),
      booking("ARRIVED", 2, 4),
      booking("ARRIVED", 2, 1),
      // A visit nobody has reviewed yet doesn't pull the average down.
      booking("ARRIVED", 2),
    ]);

    expect(numbers.ratings).toEqual({
      count: 4,
      average: 3.75,
      byRating: [
        { rating: 5, count: 2 },
        { rating: 4, count: 1 },
        { rating: 3, count: 0 },
        { rating: 2, count: 0 },
        { rating: 1, count: 1 },
      ],
    });
  });

  test("the average isn't rounded, so the page rounds it only once", () => {
    const numbers = countBookings([
      booking("ARRIVED", 2, 5),
      booking("ARRIVED", 2, 5),
      booking("ARRIVED", 2, 4),
    ]);

    expect(numbers.ratings.average).toBe(14 / 3);
  });

  test("no bookings: nothing to count, and no average", () => {
    expect(countBookings([])).toEqual({
      bookings: 0,
      statuses: { PENDING: 0, CONFIRMED: 0, ARRIVED: 0, NO_SHOW: 0, CANCELLED: 0 },
      guests: 0,
      ratings: {
        count: 0,
        average: null,
        byRating: [5, 4, 3, 2, 1].map((rating) => ({ rating, count: 0 })),
      },
    });
  });
});

describe("mostBooked", () => {
  const nurr = { id: "id-nurr", slug: "nurr", name: "Nurr" };
  const lori = { id: "id-lori", slug: "lori-smokehouse", name: "Lori Smokehouse" };
  const kond = { id: "id-kond", slug: "kond-house", name: "Kond House" };
  const at = (...ids: string[]) => ids.map((restaurantId) => ({ restaurantId }));

  test("the most booked first, each with its count", () => {
    const ranked = mostBooked(
      at("id-lori", "id-nurr", "id-nurr", "id-kond", "id-nurr", "id-lori"),
      [lori, kond, nurr],
      10,
    );

    expect(ranked).toEqual([
      { ...nurr, bookings: 3 },
      { ...lori, bookings: 2 },
      { ...kond, bookings: 1 },
    ]);
  });

  test("equal counts go by name, so the list doesn't change from one visit to the next", () => {
    const ranked = mostBooked(at("id-nurr", "id-lori", "id-kond"), [nurr, lori, kond], 10);

    expect(ranked.map(({ name }) => name)).toEqual(["Kond House", "Lori Smokehouse", "Nurr"]);
  });

  test("at most the limit, and only restaurants with bookings, with nothing else about them", () => {
    const withExtras = { ...kond, ownerId: "owner-1", hiddenAt: null };

    const ranked = mostBooked(at("id-nurr", "id-nurr", "id-lori"), [nurr, lori, withExtras], 1);

    expect(ranked).toEqual([{ ...nurr, bookings: 2 }]);
    expect(mostBooked(at("id-nurr"), [nurr, withExtras], 10)).toEqual([{ ...nurr, bookings: 1 }]);
  });
});
