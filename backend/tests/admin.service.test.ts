// Seghan's admin (src/modules/admin/admin.service.ts), with Prisma replaced: what each list asks
// for, that nothing private leaves the server, and how hiding changes only Seghan's own flag.
// tests/db/admin.test.ts runs it on real PostgreSQL, where hiding reaches every guest-facing page.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { Prisma } from "../src/generated/prisma/client.ts";
import { logger } from "../src/lib/logger.ts";
import { prisma } from "../src/lib/prisma.ts";
import {
  listReservationsForAdmin,
  listRestaurantsForAdmin,
  listUsers,
  setRestaurantHidden,
} from "../src/modules/admin/admin.service.ts";
import { nare } from "./fixtures/users.ts";

vi.mock("../src/lib/prisma.ts", () => ({
  prisma: {
    user: { findMany: vi.fn(), count: vi.fn() },
    restaurant: { findMany: vi.fn(), count: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn() },
    reservation: { findMany: vi.fn(), count: vi.fn() },
    $transaction: vi.fn((reads: Promise<unknown>[]) => Promise.all(reads)),
  },
  isDatabaseReachable: vi.fn(),
}));

const LORI = "5e4d3c2b-1a09-4f8e-9d7c-6b5a4f3e2d1c";
const NOW = new Date("2026-11-12T08:00:00.000Z");
const firstPage = { page: 1, pageSize: 20 };
const askedFor = (fn: unknown): Record<string, unknown> =>
  vi.mocked(fn as (...args: unknown[]) => unknown).mock.calls[0]?.[0] as Record<string, unknown>;

const loriRow = (extra: object = {}) => ({
  id: LORI,
  slug: "lori-smokehouse",
  name: "Lori Smokehouse",
  district: "ARABKIR",
  isPublished: true,
  hiddenAt: null,
  createdAt: new Date("2026-11-01T08:00:00.000Z"),
  owner: { name: "Ani Sargsyan", email: "ani.owner@example.com" },
  _count: { reservations: 12 },
  ...extra,
});

beforeEach(() => {
  vi.mocked(prisma.user.count).mockResolvedValue(0);
  vi.mocked(prisma.restaurant.count).mockResolvedValue(0);
  vi.mocked(prisma.reservation.count).mockResolvedValue(0);
  vi.mocked(prisma.user.findMany).mockResolvedValue([]);
  vi.mocked(prisma.restaurant.findMany).mockResolvedValue([]);
  vi.mocked(prisma.reservation.findMany).mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("listUsers", () => {
  test("by name or email, ignoring capitals, and by role; the newest first; page and total at one moment", async () => {
    await listUsers({ q: "lilit", role: "CUSTOMER", ...firstPage });

    const where = {
      role: "CUSTOMER",
      OR: [
        { name: { contains: "lilit", mode: "insensitive" } },
        { email: { contains: "lilit", mode: "insensitive" } },
      ],
    };
    expect(askedFor(prisma.user.findMany)).toMatchObject({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: 0,
      take: 20,
    });
    expect(prisma.user.count).toHaveBeenCalledWith({ where });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Array), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  });

  test("never the password hash, the Google id or anything about sessions", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      {
        id: "u-1",
        name: "Lilit Harutyunyan",
        email: "lilit@example.com",
        role: "CUSTOMER",
        createdAt: NOW,
        _count: { restaurants: 0, reservations: 3 },
      },
    ] as never);

    const { data } = await listUsers(firstPage);

    const select = askedFor(prisma.user.findMany)["select"] as Record<string, unknown>;
    expect(Object.keys(select).sort()).toEqual([
      "_count",
      "createdAt",
      "email",
      "id",
      "name",
      "role",
    ]);
    expect(data).toEqual([
      {
        id: "u-1",
        name: "Lilit Harutyunyan",
        email: "lilit@example.com",
        role: "CUSTOMER",
        createdAt: NOW.toISOString(),
        restaurants: 0,
        reservations: 3,
      },
    ]);
  });
});

describe("listRestaurantsForAdmin", () => {
  test.each([
    ["published", { isPublished: true, hiddenAt: null }],
    ["draft", { isPublished: false, hiddenAt: null }],
    ["hidden", { hiddenAt: { not: null } }],
  ] as const)("%s: what guests see decides it", async (show, where) => {
    await listRestaurantsForAdmin({ show, ...firstPage });

    expect(askedFor(prisma.restaurant.findMany)["where"]).toEqual(where);
  });

  test("everything otherwise, drafts and hidden ones included, by name or address, by name", async () => {
    vi.mocked(prisma.restaurant.findMany).mockResolvedValue([loriRow({ hiddenAt: NOW })] as never);

    const { data } = await listRestaurantsForAdmin({ q: "komitas", ...firstPage });

    expect(askedFor(prisma.restaurant.findMany)).toMatchObject({
      where: {
        OR: [
          { name: { contains: "komitas", mode: "insensitive" } },
          { address: { contains: "komitas", mode: "insensitive" } },
        ],
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    expect(data[0]).toMatchObject({
      name: "Lori Smokehouse",
      owner: { name: "Ani Sargsyan", email: "ani.owner@example.com" },
      isPublished: true,
      hiddenAt: NOW.toISOString(),
      reservations: 12,
    });
  });
});

describe("setRestaurantHidden", () => {
  beforeEach(() => {
    vi.mocked(prisma.restaurant.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.restaurant.findUnique).mockResolvedValue(loriRow({ hiddenAt: NOW }) as never);
  });

  test("hiding sets only Seghan's flag, and keeps the moment one already hidden was first hidden", async () => {
    const restaurant = await setRestaurantHidden(nare.id, LORI, true, NOW);

    expect(prisma.restaurant.updateMany).toHaveBeenCalledWith({
      where: { id: LORI, hiddenAt: null },
      data: { hiddenAt: NOW },
    });
    expect(restaurant.hiddenAt).toBe(NOW.toISOString());
  });

  test("showing it again clears it, and leaves what the owner chose", async () => {
    vi.mocked(prisma.restaurant.findUnique).mockResolvedValue(loriRow() as never);

    const restaurant = await setRestaurantHidden(nare.id, LORI, false, NOW);

    expect(prisma.restaurant.updateMany).toHaveBeenCalledWith({
      where: { id: LORI, hiddenAt: { not: null } },
      data: { hiddenAt: null },
    });
    expect(restaurant).toMatchObject({ hiddenAt: null, isPublished: true });
  });

  test("a change is logged with the admin and the restaurant, and nothing else", async () => {
    const info = vi.spyOn(logger, "info");

    await setRestaurantHidden(nare.id, LORI, true, NOW);
    vi.mocked(prisma.restaurant.updateMany).mockResolvedValue({ count: 0 });
    await setRestaurantHidden(nare.id, LORI, true, NOW);

    expect(info.mock.calls).toEqual([
      [{ restaurantId: LORI, hidden: true, adminId: nare.id }, "Restaurant visibility changed"],
    ]);
  });

  test("a restaurant that doesn't exist is a 404", async () => {
    vi.mocked(prisma.restaurant.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.restaurant.findUnique).mockResolvedValue(null);

    await expect(setRestaurantHidden(nare.id, LORI, true, NOW)).rejects.toMatchObject({
      statusCode: 404,
      code: "RESTAURANT_NOT_FOUND",
    });
  });
});

describe("listReservationsForAdmin", () => {
  test("a day is a Yerevan day, and a search looks at the restaurant and the guest", async () => {
    await listReservationsForAdmin({
      q: "lori",
      status: "NO_SHOW",
      date: "2026-11-14",
      ...firstPage,
    });

    expect(askedFor(prisma.reservation.findMany)).toMatchObject({
      where: {
        status: "NO_SHOW",
        // Midnight to midnight in Yerevan, four hours ahead of UTC.
        startsAt: {
          gte: new Date("2026-11-13T20:00:00.000Z"),
          lt: new Date("2026-11-14T20:00:00.000Z"),
        },
        OR: [
          { restaurant: { name: { contains: "lori", mode: "insensitive" } } },
          { user: { name: { contains: "lori", mode: "insensitive" } } },
          { user: { email: { contains: "lori", mode: "insensitive" } } },
        ],
      },
      orderBy: [{ startsAt: "desc" }, { id: "asc" }],
    });
  });

  test("each booking on its restaurant's clock, with the guest's name and email", async () => {
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([
      {
        id: "r-1",
        status: "CONFIRMED",
        partySize: 2,
        // 23:30 to 01:30 in Yerevan.
        startsAt: new Date("2026-11-14T19:30:00.000Z"),
        endsAt: new Date("2026-11-14T21:30:00.000Z"),
        createdAt: NOW,
        restaurant: {
          id: LORI,
          slug: "lori-smokehouse",
          name: "Lori Smokehouse",
          timezone: "Asia/Yerevan",
        },
        table: { label: "T2" },
        user: { name: "Lilit Harutyunyan", email: "lilit@example.com" },
      },
    ] as never);

    const { data } = await listReservationsForAdmin(firstPage);

    expect(data[0]).toMatchObject({
      date: "2026-11-14",
      starts: "23:30",
      ends: "01:30",
      restaurant: { id: LORI, slug: "lori-smokehouse", name: "Lori Smokehouse" },
      guest: { name: "Lilit Harutyunyan", email: "lilit@example.com" },
    });
    expect(Object.keys(data[0]!.restaurant)).not.toContain("timezone");
  });
});
