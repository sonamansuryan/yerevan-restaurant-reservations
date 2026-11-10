// A restaurant's bookings for one day (src/modules/reservations/owner.service.ts), with Prisma
// replaced: which moments a date covers, what's asked of the database, and what leaves the server.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { Prisma } from "../src/generated/prisma/client.ts";
import { NotFoundError } from "../src/lib/errors.ts";
import { prisma } from "../src/lib/prisma.ts";
import { listReservationsForDay } from "../src/modules/reservations/owner.service.ts";
import { dayReservationRow } from "./fixtures/reservations.ts";
import { ownedRow } from "./fixtures/restaurants.ts";
import { ani } from "./fixtures/users.ts";

vi.mock("../src/lib/prisma.ts", () => ({
  prisma: {
    restaurant: { findUnique: vi.fn() },
    reservation: { findMany: vi.fn(), count: vi.fn() },
    // The list and its total are read in one transaction, which here simply runs them.
    $transaction: vi.fn((reads: Promise<unknown>[]) => Promise.all(reads)),
  },
  isDatabaseReachable: vi.fn(),
}));

const findRestaurant = vi.mocked(prisma.restaurant.findUnique);
const findMany = vi.mocked(prisma.reservation.findMany);
const count = vi.mocked(prisma.reservation.count);

const RESTAURANT = ownedRow().id;
const friday = { date: "2026-11-13", page: 1, pageSize: 100 };

beforeEach(() => {
  findRestaurant.mockResolvedValue({ timezone: "Asia/Yerevan" } as never);
  findMany.mockResolvedValue([dayReservationRow()] as never);
  count.mockResolvedValue(1);
});

afterEach(() => {
  vi.clearAllMocks();
});

/** What the day view asked the database for. */
const askedFor = (): Record<string, unknown> =>
  findMany.mock.calls[0]?.[0] as Record<string, unknown>;

describe("listReservationsForDay", () => {
  test("asks about this owner's restaurant only: someone else's is a 404, and nothing is read", async () => {
    findRestaurant.mockResolvedValue(null);

    const reading = listReservationsForDay(ani.id, RESTAURANT, friday);

    await expect(reading).rejects.toThrow(NotFoundError);
    await expect(reading).rejects.toMatchObject({ code: "RESTAURANT_NOT_FOUND" });
    expect(findRestaurant).toHaveBeenCalledWith({
      where: { id: RESTAURANT, ownerId: ani.id },
      select: { timezone: true },
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  test("a date is the restaurant's own day: Yerevan midnight to midnight, as exact moments", async () => {
    await listReservationsForDay(ani.id, RESTAURANT, friday);

    expect(askedFor()["where"]).toEqual({
      restaurantId: RESTAURANT,
      startsAt: {
        gte: new Date("2026-11-12T20:00:00.000Z"),
        lt: new Date("2026-11-13T20:00:00.000Z"),
      },
    });
  });

  test("the day follows the restaurant's time zone, never a fixed one", async () => {
    findRestaurant.mockResolvedValue({ timezone: "America/New_York" } as never);

    await listReservationsForDay(ani.id, RESTAURANT, friday);

    expect(askedFor()["where"]).toMatchObject({
      startsAt: {
        gte: new Date("2026-11-13T05:00:00.000Z"),
        lt: new Date("2026-11-14T05:00:00.000Z"),
      },
    });
  });

  test("every status, by time then table, a page at a time, with its total from the same moment", async () => {
    count.mockResolvedValue(27);

    const list = await listReservationsForDay(ani.id, RESTAURANT, {
      ...friday,
      page: 2,
      pageSize: 10,
    });

    expect(askedFor()).toMatchObject({
      orderBy: [{ startsAt: "asc" }, { table: { label: "asc" } }, { id: "asc" }],
      skip: 10,
      take: 10,
    });
    // No status filter: a day's book keeps its cancellations and no-shows too.
    expect(askedFor()["where"]).not.toHaveProperty("status");
    expect(count).toHaveBeenCalledWith({ where: askedFor()["where"] });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Array), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
    expect(list.meta).toEqual({ page: 2, pageSize: 10, total: 27 });
  });

  test("each booking comes back with its times on the restaurant's clock, and the guest's name only", async () => {
    const list = await listReservationsForDay(ani.id, RESTAURANT, friday);

    expect(list.data).toEqual([
      {
        id: "b7c8d9e0-1f2a-4b3c-8d4e-5f6a7b8c9d0e",
        status: "CONFIRMED",
        partySize: 4,
        startsAt: "2026-11-13T14:00:00.000Z",
        endsAt: "2026-11-13T16:00:00.000Z",
        starts: "18:00",
        ends: "20:00",
        table: { id: "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f", label: "T4", zone: "INDOOR" },
        guest: { name: "Aram Petrosyan" },
        specialRequests: null,
        cancellation: null,
      },
    ]);
    // The database is asked for the guest's name and nothing else about them: exactly that.
    expect((askedFor()["select"] as { user?: unknown }).user).toEqual({ select: { name: true } });
  });

  test("a booking that runs past midnight ends on the next morning's clock", async () => {
    findMany.mockResolvedValue([
      dayReservationRow({
        startsAt: new Date("2026-11-13T19:00:00.000Z"),
        endsAt: new Date("2026-11-13T21:30:00.000Z"),
      }),
    ] as never);

    const [booking] = (await listReservationsForDay(ani.id, RESTAURANT, friday)).data;

    expect(booking).toMatchObject({ starts: "23:00", ends: "01:30" });
  });

  test("a cancelled booking says who cancelled and why; any other has no cancellation", async () => {
    findMany.mockResolvedValue([
      dayReservationRow({
        status: "CANCELLED",
        cancelledBy: "CUSTOMER",
        cancellationReason: "Plans changed",
      }),
      dayReservationRow({ status: "NO_SHOW" }),
    ] as never);

    const [cancelled, noShow] = (await listReservationsForDay(ani.id, RESTAURANT, friday)).data;

    expect(cancelled?.cancellation).toEqual({ by: "CUSTOMER", reason: "Plans changed" });
    expect(noShow?.cancellation).toBeNull();
  });
});
