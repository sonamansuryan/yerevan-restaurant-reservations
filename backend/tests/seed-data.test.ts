import { describe, expect, test } from "vitest";
import { z } from "zod";

import {
  openingHoursFor,
  planReservations,
  RESERVATIONS,
  RESTAURANTS,
  TIME_ZONE,
  USERS,
} from "../prisma/seed-data.ts";
import { dayOfWeek, localDate } from "../src/lib/time.ts";

const ACTIVE = ["PENDING", "CONFIRMED", "ARRIVED"];
const DAY_MS = 86_400_000;

function restaurantFor(slug: string): (typeof RESTAURANTS)[number] {
  const restaurant = RESTAURANTS.find((candidate) => candidate.slug === slug);
  if (!restaurant) throw new Error(`Unknown restaurant: ${slug}`);
  return restaurant;
}

// Booking dates depend on the day the seed runs, so every check runs for two weeks of mornings,
// plus the minutes around midnight in Yerevan, when the local date and the UTC date differ.
const RUN_TIMES = [
  ...Array.from({ length: 14 }, (_, day) => new Date(Date.UTC(2026, 10, 2 + day, 8))),
  new Date("2026-11-20T19:59:00Z"),
  new Date("2026-11-20T20:01:00Z"),
  new Date("2026-12-31T20:30:00Z"),
];

describe.each(RUN_TIMES)("bookings planned at %s", (now) => {
  const plan = planReservations(now);

  test("no two active bookings overlap on a table", () => {
    const active = plan.filter(({ status }) => ACTIVE.includes(status));

    for (const a of active) {
      for (const b of active) {
        if (a.id >= b.id || a.restaurant !== b.restaurant || a.table !== b.table) continue;
        const overlap = a.startsAt < b.endsAt && b.startsAt < a.endsAt;
        expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }
  });

  test("every booking fits its table", () => {
    for (const booking of plan) {
      const table = restaurantFor(booking.restaurant).tables.find(
        ({ label }) => label === booking.table,
      );

      expect(table, booking.id).toBeDefined();
      expect(table?.isActive, booking.id).not.toBe(false);
      expect(booking.partySize, booking.id).toBeGreaterThanOrEqual(table?.minCapacity ?? 0);
      expect(booking.partySize, booking.id).toBeLessThanOrEqual(table?.capacity ?? 0);
    }
  });

  test("every booking fits the opening hours and the slot grid", () => {
    for (const booking of plan) {
      const restaurant = restaurantFor(booking.restaurant);
      const weekday = dayOfWeek(booking.serviceDate);
      const start = booking.startMinutes;
      const fits = openingHoursFor(restaurant).some(
        ({ dayOfWeek: day, opensAt, closesAt }) =>
          day === weekday &&
          opensAt <= start &&
          start + restaurant.reservationDurationMin <= closesAt &&
          (start - opensAt) % restaurant.slotIntervalMin === 0,
      );

      expect(fits, booking.id).toBe(true);
    }
  });

  test("every booking lasts the restaurant's duration", () => {
    for (const booking of plan) {
      const minutes = (booking.endsAt.getTime() - booking.startsAt.getTime()) / 60_000;

      expect(minutes, booking.id).toBe(restaurantFor(booking.restaurant).reservationDurationMin);
    }
  });

  test("a booking's status matches its date", () => {
    const today = localDate(now, TIME_ZONE);

    for (const booking of plan) {
      if (booking.status === "PENDING" || booking.status === "CONFIRMED") {
        expect(booking.serviceDate > today, booking.id).toBe(true);
        expect(booking.startsAt.getTime(), booking.id).toBeGreaterThan(now.getTime() + 3_600_000);
        expect(booking.startsAt.getTime(), booking.id).toBeLessThan(now.getTime() + 60 * DAY_MS);
      }
      if (booking.status === "ARRIVED" || booking.status === "NO_SHOW") {
        expect(booking.endsAt.getTime(), booking.id).toBeLessThan(now.getTime());
      }
    }
  });

  test("timestamps happen in a sensible order", () => {
    for (const booking of plan) {
      expect(booking.createdAt.getTime(), booking.id).toBeLessThan(now.getTime());
      expect(booking.createdAt.getTime(), booking.id).toBeLessThan(booking.startsAt.getTime());

      if (booking.status === "CANCELLED") {
        expect(booking.cancelledBy, booking.id).not.toBeNull();
        expect(booking.cancelledAt?.getTime() ?? Infinity, booking.id).toBeLessThan(now.getTime());
        expect(booking.cancelledAt?.getTime() ?? Infinity, booking.id).toBeLessThan(
          booking.startsAt.getTime(),
        );
      } else {
        expect(booking.cancelledBy, booking.id).toBeNull();
        expect(booking.cancelledAt, booking.id).toBeNull();
      }
    }
  });
});

describe("users", () => {
  test("has 1 admin, 2 owners and 3 customers", () => {
    const count = (role: string): number => USERS.filter((user) => user.role === role).length;

    expect([count("ADMIN"), count("OWNER"), count("CUSTOMER")]).toEqual([1, 2, 3]);
  });

  test("emails are lowercase, unique and on the reserved example.com domain", () => {
    const emails = USERS.map(({ email }) => email);

    for (const email of emails) {
      expect(email).toBe(email.toLowerCase());
      expect(email.endsWith("@example.com")).toBe(true);
    }
    expect(new Set(emails).size).toBe(emails.length);
  });
});

describe("restaurants", () => {
  test("has 6 to 8, with unique slugs, spread across districts", () => {
    expect(RESTAURANTS.length).toBeGreaterThanOrEqual(6);
    expect(RESTAURANTS.length).toBeLessThanOrEqual(8);
    expect(new Set(RESTAURANTS.map(({ slug }) => slug)).size).toBe(RESTAURANTS.length);
    expect(new Set(RESTAURANTS.map(({ district }) => district)).size).toBeGreaterThanOrEqual(4);
  });

  test("every owner is an OWNER", () => {
    for (const { ownerEmail } of RESTAURANTS) {
      expect(USERS.find(({ email }) => email === ownerEmail)?.role).toBe("OWNER");
    }
  });

  test("values satisfy the database's CHECK constraints", () => {
    for (const restaurant of RESTAURANTS) {
      expect([15, 30]).toContain(restaurant.slotIntervalMin);
      expect(restaurant.reservationDurationMin).toBeGreaterThan(0);
      expect(restaurant.priceLevel).toBeGreaterThanOrEqual(1);
      expect(restaurant.priceLevel).toBeLessThanOrEqual(4);

      for (const table of restaurant.tables) {
        expect(table.minCapacity).toBeGreaterThanOrEqual(1);
        expect(table.capacity).toBeGreaterThanOrEqual(table.minCapacity);
      }
      for (const { dayOfWeek: day, opensAt, closesAt } of openingHoursFor(restaurant)) {
        expect(day).toBeGreaterThanOrEqual(0);
        expect(day).toBeLessThanOrEqual(6);
        expect(opensAt).toBeLessThan(1440);
        expect(closesAt).toBeGreaterThan(opensAt);
        expect(closesAt - opensAt).toBeLessThanOrEqual(1440);
      }
    }
  });

  test("table labels are unique within each restaurant", () => {
    for (const { tables } of RESTAURANTS) {
      expect(new Set(tables.map(({ label }) => label)).size).toBe(tables.length);
    }
  });

  test("opening hours are unique within each restaurant", () => {
    for (const restaurant of RESTAURANTS) {
      const keys = openingHoursFor(restaurant).map(
        ({ dayOfWeek: day, opensAt }) => `${day}/${opensAt}`,
      );

      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  test("covers after-midnight closing, split shifts, a closed day and an unpublished draft", () => {
    const allHours = RESTAURANTS.map(openingHoursFor);

    expect(allHours.some((hours) => hours.some(({ closesAt }) => closesAt > 1440))).toBe(true);
    expect(
      allHours.some((hours) => hours.filter(({ dayOfWeek: day }) => day === 1).length > 1),
    ).toBe(true);
    expect(allHours.some((hours) => new Set(hours.map(({ dayOfWeek: day }) => day)).size < 7)).toBe(
      true,
    );
    expect(RESTAURANTS.some(({ isPublished }) => !isPublished)).toBe(true);
  });
});

describe("reservations", () => {
  test("covers every status", () => {
    const statuses = new Set(RESERVATIONS.map(({ status }) => status));

    expect([...statuses].sort()).toEqual([
      "ARRIVED",
      "CANCELLED",
      "CONFIRMED",
      "NO_SHOW",
      "PENDING",
    ]);
  });

  test("ids are unique and valid UUIDs, so our API will accept them", () => {
    const ids = RESERVATIONS.map(({ id }) => id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(z.uuid().safeParse(id).success, id).toBe(true);
  });

  test("the unpublished restaurant has no bookings", () => {
    const hidden = RESTAURANTS.filter(({ isPublished }) => !isPublished).map(({ slug }) => slug);

    expect(RESERVATIONS.filter(({ restaurant }) => hidden.includes(restaurant))).toEqual([]);
  });

  test("every booking belongs to a customer", () => {
    for (const { customer } of RESERVATIONS) {
      expect(USERS.find(({ email }) => email === customer)?.role).toBe("CUSTOMER");
    }
  });

  test("every booking starts before midnight, as guests' bookings must", () => {
    for (const { id, startMinutes } of RESERVATIONS) {
      expect(startMinutes, id).toBeLessThan(1440);
    }
  });

  test("includes a booking that ends after midnight", () => {
    const endsAfterMidnight = RESERVATIONS.some(
      ({ restaurant, startMinutes }) =>
        startMinutes + restaurantFor(restaurant).reservationDurationMin > 1440,
    );

    expect(endsAfterMidnight).toBe(true);
  });
});
