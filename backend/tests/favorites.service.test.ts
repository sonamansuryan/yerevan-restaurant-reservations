// Favorites (src/modules/favorites/favorites.service.ts), with Prisma replaced: what each query asks
// for, that only published restaurants count, and that saving and unsaving can be repeated.
// tests/db/favorites.test.ts runs them on real PostgreSQL, including saves at the same moment.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { Prisma } from "../src/generated/prisma/client.ts";
import { NotFoundError } from "../src/lib/errors.ts";
import { prisma } from "../src/lib/prisma.ts";
import {
  getFavorite,
  listFavorites,
  removeFavorite,
  saveFavorite,
} from "../src/modules/favorites/favorites.service.ts";
import { summaryRow } from "./fixtures/restaurants.ts";
import { sessionUser } from "./fixtures/users.ts";

vi.mock("../src/lib/prisma.ts", () => ({
  prisma: {
    favorite: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    restaurant: { findUnique: vi.fn() },
    // The list and its total are read in one transaction, which here simply runs them.
    $transaction: vi.fn((reads: Promise<unknown>[]) => Promise.all(reads)),
  },
  isDatabaseReachable: vi.fn(),
}));

const findMany = vi.mocked(prisma.favorite.findMany);
const count = vi.mocked(prisma.favorite.count);
const findFirst = vi.mocked(prisma.favorite.findFirst);
const createMany = vi.mocked(prisma.favorite.createMany);
const deleteMany = vi.mocked(prisma.favorite.deleteMany);
const findRestaurant = vi.mocked(prisma.restaurant.findUnique);
const transaction = vi.mocked(prisma.$transaction);

const GUEST = sessionUser.id;
const LORI = "5e4d3c2b-1a09-4f8e-9d7c-6b5a4f3e2d1c";

afterEach(() => {
  vi.clearAllMocks();
});

describe("listFavorites", () => {
  beforeEach(() => {
    findMany.mockResolvedValue([{ restaurant: summaryRow() }] as never);
    count.mockResolvedValue(13);
  });

  test("the guest's own published favorites, the last saved first, a page at a time", async () => {
    const list = await listFavorites(GUEST, { page: 2, pageSize: 12 });

    const where = { userId: GUEST, restaurant: { isPublished: true, hiddenAt: null } };
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        orderBy: [{ createdAt: "desc" }, { restaurantId: "asc" }],
        skip: 12,
        take: 12,
      }),
    );
    expect(count).toHaveBeenCalledWith({ where });
    expect(list.meta).toEqual({ page: 2, pageSize: 12, total: 13 });
  });

  test("the page and the total are read at one moment", async () => {
    await listFavorites(GUEST, { page: 1, pageSize: 12 });

    expect(transaction).toHaveBeenCalledWith(expect.any(Array), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  });

  test("each favorite is a card, exactly as Browse lists it", async () => {
    const { data } = await listFavorites(GUEST, { page: 1, pageSize: 12 });

    expect(data).toEqual([
      expect.objectContaining({ slug: "tsiran-wine-room", name: "Tsiran Wine Room" }),
    ]);
    expect(Object.keys(data[0] ?? {})).not.toContain("id");
  });
});

describe("getFavorite", () => {
  test("saved, when the guest saved this published restaurant", async () => {
    findFirst.mockResolvedValue({ createdAt: new Date() } as never);

    expect(await getFavorite(GUEST, "lori-smokehouse")).toEqual({ saved: true });
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        userId: GUEST,
        restaurant: { slug: "lori-smokehouse", isPublished: true, hiddenAt: null },
      },
      select: { createdAt: true },
    });
  });

  test("not saved otherwise, including an address that isn't a restaurant", async () => {
    findFirst.mockResolvedValue(null);

    expect(await getFavorite(GUEST, "nowhere")).toEqual({ saved: false });
  });
});

describe("saveFavorite", () => {
  test("saves a published restaurant, skipping a copy that's already there", async () => {
    findRestaurant.mockResolvedValue({ id: LORI } as never);

    expect(await saveFavorite(GUEST, "lori-smokehouse")).toEqual({ saved: true });
    expect(findRestaurant).toHaveBeenCalledWith({
      where: { slug: "lori-smokehouse", isPublished: true, hiddenAt: null },
      select: { id: true },
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [{ userId: GUEST, restaurantId: LORI }],
      skipDuplicates: true,
    });
  });

  test("a restaurant that doesn't exist, or isn't published, is a 404, and nothing is saved", async () => {
    findRestaurant.mockResolvedValue(null);

    await expect(saveFavorite(GUEST, "davtashen-test-kitchen")).rejects.toEqual(
      new NotFoundError("RESTAURANT_NOT_FOUND"),
    );
    expect(createMany).not.toHaveBeenCalled();
  });
});

describe("removeFavorite", () => {
  test("takes out only this guest's favorite of that restaurant, and one not there is already out", async () => {
    deleteMany.mockResolvedValue({ count: 0 });

    expect(await removeFavorite(GUEST, "lori-smokehouse")).toEqual({ saved: false });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { userId: GUEST, restaurant: { slug: "lori-smokehouse" } },
    });
  });
});
