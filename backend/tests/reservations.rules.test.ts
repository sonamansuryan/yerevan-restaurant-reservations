// The rules for changing a booking's status (src/modules/reservations/reservations.rules.ts): when
// a guest can cancel, and which changes a restaurant can make, from which status and when
// (PROJECT_PLAN.md §5.3).
import { describe, expect, test } from "vitest";

import type { ReservationStatus } from "../src/generated/prisma/enums.ts";
import {
  canGuestCancel,
  canGuestReview,
  RESTAURANT_CHANGES,
  restaurantChangeProblem,
} from "../src/modules/reservations/reservations.rules.ts";
import type { RestaurantChange } from "../src/modules/reservations/reservations.rules.ts";

// Saturday 14 November 2026, 19:00 in Yerevan.
const STARTS = new Date("2026-11-14T15:00:00.000Z");
const before = (milliseconds: number): Date => new Date(STARTS.getTime() - milliseconds);
const after = (milliseconds: number): Date => new Date(STARTS.getTime() + milliseconds);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
// Two hours long: it ends at 21:00.
const ENDS = after(2 * HOUR);

const STATUSES: ReservationStatus[] = ["PENDING", "CONFIRMED", "ARRIVED", "NO_SHOW", "CANCELLED"];
const problem = (status: ReservationStatus, change: RestaurantChange, now: Date) =>
  restaurantChangeProblem({ status, startsAt: STARTS, endsAt: ENDS }, change, now);

describe("canGuestReview", () => {
  test("a visit the restaurant marked arrived can be reviewed, once", () => {
    expect(canGuestReview({ status: "ARRIVED" }, false)).toBe(true);
    expect(canGuestReview({ status: "ARRIVED" }, true)).toBe(false);
  });

  test("no other booking can: not before the visit, nor after a no-show or a cancellation", () => {
    for (const status of ["PENDING", "CONFIRMED", "NO_SHOW", "CANCELLED"] as const) {
      expect(canGuestReview({ status }, false), status).toBe(false);
    }
  });
});

describe("canGuestCancel", () => {
  test("a pending or confirmed booking can be cancelled, days ahead or a minute before it starts", () => {
    for (const status of ["PENDING", "CONFIRMED"] as const) {
      expect(canGuestCancel({ status, startsAt: STARTS }, before(3 * DAY))).toBe(true);
      expect(canGuestCancel({ status, startsAt: STARTS }, before(MINUTE))).toBe(true);
    }
  });

  test("from its start time on, it's too late, to the millisecond", () => {
    expect(canGuestCancel({ status: "CONFIRMED", startsAt: STARTS }, before(1))).toBe(true);
    expect(canGuestCancel({ status: "CONFIRMED", startsAt: STARTS }, STARTS)).toBe(false);
    expect(canGuestCancel({ status: "PENDING", startsAt: STARTS }, after(MINUTE))).toBe(false);
  });

  test("statuses only move forward: arrived, no-show and cancelled never can, however early", () => {
    // A guest can arrive up to 30 minutes early, so "arrived" can come before the start.
    for (const status of ["ARRIVED", "NO_SHOW", "CANCELLED"] as const) {
      expect(canGuestCancel({ status, startsAt: STARTS }, before(30 * MINUTE))).toBe(false);
    }
  });
});

describe("restaurantChangeProblem", () => {
  test("each change comes only from the statuses in §5.3", () => {
    // A moment each change's time allows, so only the status decides.
    const inTime: Record<RestaurantChange, Date> = {
      CONFIRMED: before(HOUR),
      CANCELLED: before(HOUR),
      ARRIVED: after(10 * MINUTE),
      NO_SHOW: after(10 * MINUTE),
    };
    const allowedFrom = (change: RestaurantChange): ReservationStatus[] =>
      STATUSES.filter((status) => problem(status, change, inTime[change]) === null);

    expect(
      Object.fromEntries(RESTAURANT_CHANGES.map((change) => [change, allowedFrom(change)])),
    ).toEqual({
      CONFIRMED: ["PENDING"],
      CANCELLED: ["PENDING", "CONFIRMED"],
      ARRIVED: ["PENDING", "CONFIRMED"],
      NO_SHOW: ["CONFIRMED"],
    });
  });

  test("statuses only move forward: nothing leads back to pending, and the last three are final", () => {
    expect(RESTAURANT_CHANGES).not.toContain("PENDING");
    for (const status of ["ARRIVED", "NO_SHOW", "CANCELLED"] as const) {
      for (const change of RESTAURANT_CHANGES) {
        for (const now of [before(DAY), STARTS, after(DAY)]) {
          expect(problem(status, change, now), `${status} → ${change}`).toBe("WRONG_STATUS");
        }
      }
    }
  });

  test("a confirm can be followed by a cancel, but a cancel never by a confirm, for either side", () => {
    const early = before(HOUR);

    expect(problem("CONFIRMED", "CANCELLED", early)).toBeNull();
    expect(canGuestCancel({ status: "CONFIRMED", startsAt: STARTS }, early)).toBe(true);
    expect(problem("CANCELLED", "CONFIRMED", early)).toBe("WRONG_STATUS");
  });

  test("the status is checked first: a booking that has moved on is refused for that, at any time", () => {
    expect(problem("CANCELLED", "CONFIRMED", after(HOUR))).toBe("WRONG_STATUS");
    expect(problem("PENDING", "ARRIVED", before(2 * HOUR))).toBe("WRONG_STATUS");
    expect(problem("PENDING", "NO_SHOW", before(HOUR))).toBe("WRONG_STATUS");
  });

  test("confirming: until the booking starts, to the millisecond", () => {
    expect(problem("PENDING", "CONFIRMED", before(30 * DAY))).toBeNull();
    expect(problem("PENDING", "CONFIRMED", before(1))).toBeNull();
    expect(problem("PENDING", "CONFIRMED", STARTS)).toBe("TOO_LATE");
    expect(problem("PENDING", "CONFIRMED", after(HOUR))).toBe("TOO_LATE");
  });

  test("cancelling: any time, even after the booking is over", () => {
    for (const status of ["PENDING", "CONFIRMED"] as const) {
      for (const now of [before(30 * DAY), STARTS, after(3 * HOUR), after(7 * DAY)]) {
        expect(problem(status, "CANCELLED", now)).toBeNull();
      }
    }
  });

  test("a pending booking is marked arrived only while it's on: before, it's confirmed first", () => {
    expect(problem("PENDING", "ARRIVED", before(1))).toBe("WRONG_STATUS");
    expect(problem("PENDING", "ARRIVED", STARTS)).toBeNull();
    expect(problem("PENDING", "ARRIVED", after(HOUR))).toBeNull();
    expect(problem("PENDING", "ARRIVED", new Date(ENDS.getTime() - 1))).toBeNull();
    expect(problem("PENDING", "ARRIVED", ENDS)).toBe("TOO_LATE");
    expect(problem("PENDING", "ARRIVED", after(3 * HOUR))).toBe("TOO_LATE");
  });

  test("a confirmed booking is marked arrived from 30 minutes before the start, and later still", () => {
    expect(problem("CONFIRMED", "ARRIVED", before(30 * MINUTE + 1))).toBe("TOO_EARLY");
    expect(problem("CONFIRMED", "ARRIVED", before(30 * MINUTE))).toBeNull();
    expect(problem("CONFIRMED", "ARRIVED", STARTS)).toBeNull();
    expect(problem("CONFIRMED", "ARRIVED", after(3 * HOUR))).toBeNull();
  });

  test("no-show: only after the start, to the millisecond", () => {
    expect(problem("CONFIRMED", "NO_SHOW", before(HOUR))).toBe("TOO_EARLY");
    expect(problem("CONFIRMED", "NO_SHOW", STARTS)).toBe("TOO_EARLY");
    expect(problem("CONFIRMED", "NO_SHOW", after(1))).toBeNull();
    expect(problem("CONFIRMED", "NO_SHOW", after(DAY))).toBeNull();
  });
});
