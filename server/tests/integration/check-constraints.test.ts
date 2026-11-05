// Proves every CHECK constraint against real Postgres, in both directions: bad values are rejected
// by the right constraint, and the valid values closest to the limit are accepted.
import { randomUUID } from "node:crypto";

import { describe, expect, test } from "vitest";

import { prisma } from "../../src/lib/prisma.ts";
import { at, booking, createFixture, databaseError, rejectionOf } from "./helpers.ts";
import type { Fixture } from "./helpers.ts";

type Write = (fixture: Fixture) => Promise<unknown>;

const reservation =
  (startsAt: string, endsAt: string, partySize = 2): Write =>
  (fixture) =>
    prisma.reservation.create({ data: booking(fixture, startsAt, endsAt, { partySize }) });

const blockedPeriod =
  (startsAt: string, endsAt: string): Write =>
  ({ restaurantId }) =>
    prisma.blockedPeriod.create({
      data: { restaurantId, startsAt: new Date(startsAt), endsAt: new Date(endsAt) },
    });

const table =
  (capacity: number, minCapacity: number): Write =>
  ({ restaurantId }) =>
    prisma.table.create({ data: { restaurantId, label: randomUUID(), capacity, minCapacity } });

const openingHour =
  (dayOfWeek: number, opensAt: number, closesAt: number): Write =>
  ({ restaurantId }) =>
    prisma.openingHour.create({ data: { restaurantId, dayOfWeek, opensAt, closesAt } });

const review =
  (rating: number): Write =>
  async (fixture) => {
    const { id: reservationId } = await prisma.reservation.create({
      data: booking(fixture, at("10:00"), at("12:00")),
    });
    const { restaurantId, userId } = fixture;
    return prisma.review.create({ data: { reservationId, restaurantId, userId, rating } });
  };

const restaurant =
  (settings: {
    priceLevel?: number;
    slotIntervalMin?: number;
    reservationDurationMin?: number;
  }): Write =>
  ({ userId }) =>
    prisma.restaurant.create({
      data: {
        ownerId: userId,
        slug: randomUUID(),
        name: "Test",
        district: "KENTRON",
        address: "Test",
        ...settings,
      },
    });

const user =
  (emailPrefix: string): Write =>
  () =>
    prisma.user.create({
      data: { email: `${emailPrefix}-${randomUUID()}@example.com`, name: "Test" },
    });

describe("bad values are rejected by the right constraint", () => {
  const cases: [string, string, Write][] = [
    [
      "Reservation_valid_range",
      "a booking that ends when it starts",
      reservation(at("19:00"), at("19:00")),
    ],
    [
      "Reservation_valid_range",
      "a booking that ends before it starts",
      reservation(at("19:00"), at("18:00")),
    ],
    ["Reservation_party_size", "a party of 0", reservation(at("19:00"), at("21:00"), 0)],
    ["Reservation_party_size", "a negative party", reservation(at("19:00"), at("21:00"), -1)],
    [
      "BlockedPeriod_valid_range",
      "a block that ends when it starts",
      blockedPeriod(at("10:00"), at("10:00")),
    ],
    [
      "BlockedPeriod_valid_range",
      "a block that ends before it starts",
      blockedPeriod(at("10:00"), at("09:00")),
    ],
    ["Table_capacity", "a minimum party of 0", table(4, 0)],
    ["Table_capacity", "a capacity below the minimum", table(2, 3)],
    ["OpeningHour_day", "day 7", openingHour(7, 720, 900)],
    ["OpeningHour_day", "day -1", openingHour(-1, 720, 900)],
    ["OpeningHour_range", "opening before midnight", openingHour(1, -1, 900)],
    ["OpeningHour_range", "opening at minute 1440", openingHour(1, 1440, 1500)],
    ["OpeningHour_range", "closing when it opens", openingHour(1, 720, 720)],
    ["OpeningHour_range", "closing before it opens", openingHour(1, 900, 720)],
    ["OpeningHour_range", "being open more than 24 hours", openingHour(1, 600, 2041)],
    ["Review_rating", "a rating of 0", review(0)],
    ["Review_rating", "a rating of 6", review(6)],
    ["Restaurant_price_level", "a price level of 0", restaurant({ priceLevel: 0 })],
    ["Restaurant_price_level", "a price level of 5", restaurant({ priceLevel: 5 })],
    ["Restaurant_slot_interval", "a slot interval of 0", restaurant({ slotIntervalMin: 0 })],
    ["Restaurant_slot_interval", "a slot interval of 20", restaurant({ slotIntervalMin: 20 })],
    [
      "Restaurant_reservation_duration",
      "a duration of 0",
      restaurant({ reservationDurationMin: 0 }),
    ],
    [
      "Restaurant_reservation_duration",
      "a negative duration",
      restaurant({ reservationDurationMin: -30 }),
    ],
    ["User_email_lowercase", "an email with capitals", user("Anna")],
  ];

  test.each(cases)("%s rejects %s", async (constraint, _name, write) => {
    const fixture = await createFixture();

    const error = await rejectionOf(write(fixture));

    expect(databaseError(error).sqlState).toBe("23514");
    expect(databaseError(error).message).toContain(`"${constraint}"`);
  });
});

describe("valid values at the limit are accepted", () => {
  const cases: [string, Write][] = [
    ["a party of 1", reservation(at("19:00"), at("21:00"), 1)],
    ["a one-person table", table(1, 1)],
    ["Sunday, day 0", openingHour(0, 720, 900)],
    ["Saturday, day 6", openingHour(6, 720, 900)],
    ["opening at midnight", openingHour(1, 0, 60)],
    ["opening at the last minute of the day", openingHour(1, 1439, 1500)],
    ["closing at 02:00 the next morning", openingHour(5, 1080, 1560)],
    ["being open exactly 24 hours", openingHour(1, 0, 1440)],
    ["a rating of 1", review(1)],
    ["a rating of 5", review(5)],
    ["a price level of 1", restaurant({ priceLevel: 1 })],
    ["a price level of 4", restaurant({ priceLevel: 4 })],
    ["a slot interval of 15", restaurant({ slotIntervalMin: 15 })],
    ["a slot interval of 30", restaurant({ slotIntervalMin: 30 })],
    ["a duration of 1 minute", restaurant({ reservationDurationMin: 1 })],
    ["a lowercase email", user("anna")],
  ];

  test.each(cases)("%s", async (_name, write) => {
    const fixture = await createFixture();

    await expect(write(fixture)).resolves.toBeDefined();
  });
});
