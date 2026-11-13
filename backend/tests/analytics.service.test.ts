// Seghan's analytics (src/modules/analytics/analytics.service.ts, task 9.6), with Prisma replaced:
// which bookings each asks for, that an owner only ever reads their own restaurant's, and that
// nothing but counts and restaurant names comes back. The counting itself is in
// analytics.rules.test.ts, and tests/db/analytics.test.ts runs both on real PostgreSQL.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { Prisma } from "../src/generated/prisma/client.ts";
import { NotFoundError } from "../src/lib/errors.ts";
import { prisma } from "../src/lib/prisma.ts";
import {
  MOST_BOOKED_LIMIT,
  restaurantAnalytics,
  seghanAnalytics,
} from "../src/modules/analytics/analytics.service.ts";
import { ani } from "./fixtures/users.ts";

vi.mock("../src/lib/prisma.ts", () => {
  const client = {
    restaurant: { findUnique: vi.fn(), findMany: vi.fn() },
    reservation: { findMany: vi.fn() },
    // A transaction's work gets the client itself as `tx`.
    $transaction: vi.fn((work: (tx: unknown) => unknown) => work(client)),
  };
  return { prisma: client, isDatabaseReachable: vi.fn() };
});

const findRestaurant = vi.mocked(prisma.restaurant.findUnique);
const findRestaurants = vi.mocked(prisma.restaurant.findMany);
const findBookings = vi.mocked(prisma.reservation.findMany);
const transaction = vi.mocked(prisma.$transaction);

const LORI = "5e4d3c2b-1a09-4f8e-9d7c-6b5a4f3e2d1c";
const NURR = "6f5e4d3c-2b1a-4098-8e7d-6c5b4a3f2e1d";
// Midday on Thursday 12 November 2026 in Yerevan.
const NOW = new Date("2026-11-12T08:00:00.000Z");
const REPEATABLE_READ = { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead };
const askedFor = (fn: unknown, call = 0): Record<string, unknown> =>
  vi.mocked(fn as (...args: unknown[]) => unknown).mock.calls[call]?.[0] as Record<string, unknown>;

const row = (status: string, partySize = 2, rating: number | null = null, restaurantId = LORI) => ({
  status,
  partySize,
  review: rating === null ? null : { rating },
  restaurantId,
});

beforeEach(() => {
  findRestaurant.mockResolvedValue({ timezone: "Asia/Yerevan" } as never);
  findRestaurants.mockResolvedValue([]);
  findBookings.mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("restaurantAnalytics", () => {
  test("the owner's own restaurant only: someone else's is a 404, and nothing is read", async () => {
    findRestaurant.mockResolvedValue(null);

    await expect(restaurantAnalytics(ani.id, LORI, { days: 30 }, NOW)).rejects.toBeInstanceOf(
      NotFoundError,
    );

    expect(askedFor(findRestaurant)).toEqual({
      where: { id: LORI, ownerId: ani.id },
      select: { timezone: true },
    });
    expect(findBookings).not.toHaveBeenCalled();
  });

  test("its bookings for the days asked for, at one moment, and only what the counting needs", async () => {
    await restaurantAnalytics(ani.id, LORI, { days: 7 }, NOW);

    expect(askedFor(findBookings)).toEqual({
      where: {
        restaurantId: LORI,
        // From Yerevan's midnight on 6 November to the midnight after today, the 12th.
        startsAt: {
          gte: new Date("2026-11-05T20:00:00.000Z"),
          lt: new Date("2026-11-12T20:00:00.000Z"),
        },
      },
      select: { status: true, partySize: true, review: { select: { rating: true } } },
    });
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), REPEATABLE_READ);
  });

  test("the days are on the restaurant's own calendar", async () => {
    findRestaurant.mockResolvedValue({ timezone: "Europe/Paris" } as never);

    const { period } = await restaurantAnalytics(ani.id, LORI, { days: 7 }, NOW);

    expect(period).toEqual({ days: 7, from: "2026-11-06", to: "2026-11-12" });
    expect(askedFor(findBookings)).toMatchObject({
      where: {
        startsAt: {
          gte: new Date("2026-11-05T23:00:00.000Z"),
          lt: new Date("2026-11-12T23:00:00.000Z"),
        },
      },
    });
  });

  test("the reply: the days, then what the bookings add up to", async () => {
    findBookings.mockResolvedValue([
      row("ARRIVED", 4, 5),
      row("ARRIVED", 2),
      row("NO_SHOW", 3),
      row("CANCELLED", 2),
      row("CONFIRMED", 6),
    ] as never);

    expect(await restaurantAnalytics(ani.id, LORI, { days: 30 }, NOW)).toEqual({
      period: { days: 30, from: "2026-10-14", to: "2026-11-12" },
      bookings: 5,
      statuses: { PENDING: 0, CONFIRMED: 1, ARRIVED: 2, NO_SHOW: 1, CANCELLED: 1 },
      guests: 6,
      ratings: {
        count: 1,
        average: 5,
        byRating: [
          { rating: 5, count: 1 },
          { rating: 4, count: 0 },
          { rating: 3, count: 0 },
          { rating: 2, count: 0 },
          { rating: 1, count: 0 },
        ],
      },
    });
  });
});

describe("seghanAnalytics", () => {
  test("every restaurant's bookings for those days, on Yerevan's calendar, at one moment", async () => {
    await seghanAnalytics({ days: 30 }, NOW);

    expect(askedFor(findBookings)).toEqual({
      // No restaurant in it: drafts and the ones Seghan has hidden count too.
      where: {
        startsAt: {
          gte: new Date("2026-10-13T20:00:00.000Z"),
          lt: new Date("2026-11-12T20:00:00.000Z"),
        },
      },
      select: {
        status: true,
        partySize: true,
        review: { select: { rating: true } },
        restaurantId: true,
      },
    });
    expect(findRestaurant).not.toHaveBeenCalled();
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), REPEATABLE_READ);
  });

  test("the most booked: only the restaurants those bookings are at, by name and link only", async () => {
    findBookings.mockResolvedValue([
      row("ARRIVED", 2, null, NURR),
      row("CANCELLED", 2, null, LORI),
      row("PENDING", 2, null, NURR),
    ] as never);
    findRestaurants.mockResolvedValue([
      { id: LORI, slug: "lori-smokehouse", name: "Lori Smokehouse" },
      { id: NURR, slug: "nurr", name: "Nurr" },
    ] as never);

    const numbers = await seghanAnalytics({ days: 7 }, NOW);

    expect(askedFor(findRestaurants)).toEqual({
      where: { id: { in: [NURR, LORI] } },
      select: { id: true, slug: true, name: true },
    });
    expect(numbers).toMatchObject({
      period: { days: 7, from: "2026-11-06", to: "2026-11-12" },
      bookings: 3,
      guests: 2,
      restaurants: [
        { id: NURR, slug: "nurr", name: "Nurr", bookings: 2 },
        { id: LORI, slug: "lori-smokehouse", name: "Lori Smokehouse", bookings: 1 },
      ],
    });
  });

  test(`at most ${MOST_BOOKED_LIMIT} restaurants, however many have bookings`, async () => {
    const ids = Array.from({ length: 12 }, (_, index) => `restaurant-${index}`);
    findBookings.mockResolvedValue(ids.map((id) => row("CONFIRMED", 2, null, id)) as never);
    findRestaurants.mockResolvedValue(
      ids.map((id) => ({ id, slug: id, name: `Restaurant ${id}` })) as never,
    );

    const { restaurants } = await seghanAnalytics({ days: 90 }, NOW);

    expect(restaurants).toHaveLength(MOST_BOOKED_LIMIT);
  });
});
