// The rules for changing a table (src/modules/tables/tables.rules.ts), with no database.
import { describe, expect, test } from "vitest";

import {
  bookingsInTheWay,
  mayAffectBookings,
  refusalMessage,
  seatsAfter,
} from "../src/modules/tables/tables.rules.ts";

// Lori Smokehouse's T1: four seats, for two to four guests. Saturday has a party of four at 12:30
// and a party of three at 19:00 on it.
const t1 = { capacity: 4, minCapacity: 2, isActive: true };
const lunch = { id: "lunch", partySize: 4 };
const dinner = { id: "dinner", partySize: 3 };
const saturday = [lunch, dinner];

describe("the seats after a change", () => {
  test("are what's sent, and what's saved for the rest", () => {
    expect(seatsAfter(t1, { capacity: 6 })).toEqual({ capacity: 6, minCapacity: 2 });
    expect(seatsAfter(t1, { minCapacity: 3 })).toEqual({ capacity: 4, minCapacity: 3 });
    expect(seatsAfter(t1, {})).toEqual({ capacity: 4, minCapacity: 2 });
  });
});

describe("which changes could let a booking down", () => {
  test("switching an active table off, or fewer seats", () => {
    expect(mayAffectBookings(t1, { isActive: false })).toBe(true);
    expect(mayAffectBookings(t1, { capacity: 3 })).toBe(true);
  });

  test("never more seats, a higher minimum, switching back on, or the same seats", () => {
    expect(mayAffectBookings(t1, { capacity: 6 })).toBe(false);
    expect(mayAffectBookings(t1, { capacity: 4 })).toBe(false);
    expect(mayAffectBookings(t1, { minCapacity: 4 })).toBe(false);
    expect(mayAffectBookings({ ...t1, isActive: false }, { isActive: true })).toBe(false);
    expect(mayAffectBookings({ ...t1, isActive: false }, { isActive: false })).toBe(false);
    expect(mayAffectBookings(t1, {})).toBe(false);
  });
});

describe("the bookings in the way", () => {
  test("every upcoming booking stands in the way of deactivating", () => {
    expect(bookingsInTheWay(t1, { isActive: false }, saturday)).toEqual({
      refusal: "TABLE_HAS_BOOKINGS",
      bookings: [lunch, dinner],
    });
  });

  test("with nothing upcoming, deactivating is fine", () => {
    expect(bookingsInTheWay(t1, { isActive: false }, [])).toBeNull();
  });

  test("fewer seats fail only the parties that wouldn't fit", () => {
    expect(bookingsInTheWay(t1, { capacity: 3 }, saturday)).toEqual({
      refusal: "TABLE_TOO_SMALL",
      bookings: [lunch],
    });
    expect(bookingsInTheWay(t1, { capacity: 2 }, saturday)).toEqual({
      refusal: "TABLE_TOO_SMALL",
      bookings: [lunch, dinner],
    });
  });

  test("seats down to exactly the biggest party are fine", () => {
    const t4 = { capacity: 6, minCapacity: 3, isActive: true };

    expect(bookingsInTheWay(t4, { capacity: 4 }, saturday)).toBeNull();
  });

  test("deactivating and fewer seats at once count as deactivating, with every booking", () => {
    expect(bookingsInTheWay(t1, { isActive: false, capacity: 3 }, saturday)).toEqual({
      refusal: "TABLE_HAS_BOOKINGS",
      bookings: [lunch, dinner],
    });
  });

  test("a higher minimum, more seats or switching back on is never in a booking's way", () => {
    expect(bookingsInTheWay(t1, { minCapacity: 4 }, saturday)).toBeNull();
    expect(bookingsInTheWay(t1, { capacity: 8 }, saturday)).toBeNull();
    expect(bookingsInTheWay({ ...t1, isActive: false }, { isActive: true }, saturday)).toBeNull();
  });
});

describe("what the owner is told", () => {
  test("deactivating names how many bookings need the table", () => {
    expect(refusalMessage("TABLE_HAS_BOOKINGS", [dinner])).toBe(
      "An upcoming booking still needs this table. You can deactivate it once that booking is over or cancelled.",
    );
    expect(refusalMessage("TABLE_HAS_BOOKINGS", saturday)).toBe(
      "2 upcoming bookings still need this table. You can deactivate it once they're over or cancelled.",
    );
  });

  test("fewer seats names the seats to keep, for the biggest party", () => {
    expect(refusalMessage("TABLE_TOO_SMALL", [lunch])).toBe(
      "An upcoming booking for 4 guests needs this table. Keep at least 4 seats until it's over or cancelled.",
    );
    expect(refusalMessage("TABLE_TOO_SMALL", [dinner, lunch])).toBe(
      "2 upcoming bookings need more seats than that, for up to 4 guests. Keep at least 4 seats until they're over or cancelled.",
    );
  });
});
