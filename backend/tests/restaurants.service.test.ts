// The restaurants service, with Prisma replaced: what it asks the database for, and how it turns
// rows into replies. The fake in fake-prisma.ts only does simple lookups, so it isn't used here.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { mapsEnabled } from "../src/integrations/geoapify/maps.ts";
import { prisma } from "../src/lib/prisma.ts";
import {
  getRestaurant,
  googleMapsUrl,
  listFeatured,
  listRestaurants,
} from "../src/modules/restaurants/restaurants.service.ts";
import { detailRow, summaryRow } from "./fixtures/restaurants.ts";

vi.mock("../src/lib/prisma.ts", () => ({
  prisma: {
    restaurant: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
    // The list sends both of its reads in one transaction, which here simply runs them.
    $transaction: vi.fn((reads: Promise<unknown>[]) => Promise.all(reads)),
  },
  isDatabaseReachable: vi.fn(),
}));

const findMany = vi.mocked(prisma.restaurant.findMany);
const count = vi.mocked(prisma.restaurant.count);
const findUnique = vi.mocked(prisma.restaurant.findUnique);

beforeEach(() => {
  findMany.mockResolvedValue([summaryRow()] as never);
  count.mockResolvedValue(1 as never);
});

afterEach(() => {
  vi.clearAllMocks();
});

const firstPage = { page: 1, pageSize: 12, sort: "name" } as const;

/** What the list asked the database for. */
function askedFor(): Record<string, unknown> {
  return findMany.mock.calls[0]?.[0] as Record<string, unknown>;
}

describe("listRestaurants", () => {
  test("asks for published restaurants only, by name, the first 12", async () => {
    await listRestaurants(firstPage);

    expect(askedFor()).toMatchObject({
      where: { isPublished: true, hiddenAt: null },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: 0,
      take: 12,
    });
    expect(count).toHaveBeenCalledWith({ where: { isPublished: true, hiddenAt: null } });
  });

  test("by rating: the best rated first, more reviews before fewer at the same rating, then by name", async () => {
    await listRestaurants({ ...firstPage, sort: "rating" });

    // No reviews is a rating of 0, so restaurants without any come last.
    expect(askedFor()["orderBy"]).toEqual([
      { avgRating: "desc" },
      { reviewCount: "desc" },
      { name: "asc" },
      { id: "asc" },
    ]);
  });

  test("reads the page and the total in one transaction, at REPEATABLE READ", async () => {
    await listRestaurants(firstPage);

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Array), {
      isolationLevel: "RepeatableRead",
    });
  });

  test("each filter becomes a condition, and published stays one of them", async () => {
    await listRestaurants({ ...firstPage, cuisine: "GEORGIAN", district: "KENTRON", price: 1 });

    const where = {
      isPublished: true,
      hiddenAt: null,
      cuisines: { has: "GEORGIAN" },
      district: "KENTRON",
      priceLevel: 1,
    };
    expect(askedFor()["where"]).toEqual(where);
    expect(count).toHaveBeenCalledWith({ where });
  });

  test("a search looks in the name, description and address, ignoring capitals", async () => {
    await listRestaurants({ ...firstPage, q: "khachapuri" });

    expect(askedFor()["where"]).toEqual({
      isPublished: true,
      hiddenAt: null,
      OR: [
        { name: { contains: "khachapuri", mode: "insensitive" } },
        { description: { contains: "khachapuri", mode: "insensitive" } },
        { address: { contains: "khachapuri", mode: "insensitive" } },
      ],
    });
  });

  test("page 3 of 6 skips the first 12", async () => {
    await listRestaurants({ page: 3, pageSize: 6, sort: "name" });

    expect(askedFor()).toMatchObject({ skip: 12, take: 6 });
  });

  test("never selects who owns a restaurant, or anything else the list doesn't show", async () => {
    await listRestaurants(firstPage);

    expect(Object.keys(askedFor()["select"] as object).sort()).toEqual([
      "address",
      "avgRating",
      "cuisines",
      "description",
      "district",
      // Whether it's a demo listing (9.7), so its card can say so.
      "isDemoListing",
      "name",
      "photos",
      "priceLevel",
      "reviewCount",
      "slug",
    ]);
  });

  test("returns the page as summaries, with the total for paging", async () => {
    count.mockResolvedValue(30 as never);

    const result = await listRestaurants({ ...firstPage, page: 2 });

    expect(result).toEqual({
      data: [
        {
          slug: "tsiran-wine-room",
          name: "Tsiran Wine Room",
          description: "Armenian wines by the glass, with small plates until late at the weekend.",
          cuisines: ["ARMENIAN", "EUROPEAN"],
          district: "KENTRON",
          address: "31 Saryan Street, Yerevan",
          priceLevel: 2,
          avgRating: 0,
          reviewCount: 0,
          coverPhotoUrl: null,
          isDemoListing: false,
        },
      ],
      meta: { page: 2, pageSize: 12, total: 30 },
    });
  });

  test("the cover photo is the first one the query returns, and no cuisines reads as none", async () => {
    findMany.mockResolvedValue([
      summaryRow({ cuisines: null, photos: [{ url: "https://res.cloudinary.com/x/cover.jpg" }] }),
    ] as never);

    const { data } = await listRestaurants(firstPage);

    expect(data[0]).toMatchObject({
      cuisines: [],
      coverPhotoUrl: "https://res.cloudinary.com/x/cover.jpg",
    });
  });
});

describe("getRestaurant", () => {
  test("says where its map is, once maps are set up, and nothing when they aren't", async () => {
    findUnique.mockResolvedValue(detailRow() as never);

    expect((await getRestaurant("tsiran-wine-room")).mapImageUrl).toBe(
      "/api/restaurants/tsiran-wine-room/map",
    );

    vi.mocked(mapsEnabled).mockReturnValueOnce(false);
    expect((await getRestaurant("tsiran-wine-room")).mapImageUrl).toBeNull();
  });

  test("asks for that slug, published only", async () => {
    findUnique.mockResolvedValue(detailRow() as never);

    await getRestaurant("tsiran-wine-room");

    expect(findUnique.mock.calls[0]?.[0]).toMatchObject({
      where: { slug: "tsiran-wine-room", isPublished: true, hiddenAt: null },
    });
  });

  test("one that doesn't exist or isn't published is a 404", async () => {
    findUnique.mockResolvedValue(null as never);

    await expect(getRestaurant("davtashen-test-kitchen")).rejects.toMatchObject({
      statusCode: 404,
      code: "RESTAURANT_NOT_FOUND",
    });
  });

  test("gives opening hours ready to show, with a closing time past midnight as 02:00", async () => {
    findUnique.mockResolvedValue(detailRow() as never);

    const restaurant = await getRestaurant("tsiran-wine-room");

    expect(restaurant.openingHours).toEqual([
      { dayOfWeek: 0, opensAt: 1080, closesAt: 1380, opens: "18:00", closes: "23:00" },
      { dayOfWeek: 2, opensAt: 1080, closesAt: 1380, opens: "18:00", closes: "23:00" },
      { dayOfWeek: 5, opensAt: 1080, closesAt: 1560, opens: "18:00", closes: "02:00" },
      { dayOfWeek: 6, opensAt: 1080, closesAt: 1560, opens: "18:00", closes: "02:00" },
    ]);
  });

  test("gives its photos, cover first, and a Maps link, but not the raw place id", async () => {
    findUnique.mockResolvedValue(
      detailRow({
        googlePlaceId: "ChIJ-test-place",
        photos: [
          { url: "https://res.cloudinary.com/x/cover.jpg", isCover: true },
          { url: "https://res.cloudinary.com/x/room.jpg", isCover: false },
        ],
      }) as never,
    );

    const restaurant = await getRestaurant("tsiran-wine-room");

    expect(restaurant.coverPhotoUrl).toBe("https://res.cloudinary.com/x/cover.jpg");
    expect(restaurant.photos).toEqual([
      { url: "https://res.cloudinary.com/x/cover.jpg", isCover: true },
      { url: "https://res.cloudinary.com/x/room.jpg", isCover: false },
    ]);
    expect(restaurant.mapsUrl).toContain("query_place_id=ChIJ-test-place");
    expect(Object.keys(restaurant)).not.toContain("googlePlaceId");
  });

  test("a demo listing (9.7) says so, has no price, names its place at OpenStreetMap, and credits its photos", async () => {
    findUnique.mockResolvedValue(
      detailRow({
        slug: "dolmama",
        isDemoListing: true,
        priceLevel: null,
        osmRef: "node/6566646015",
        photos: [
          {
            url: "https://res.cloudinary.com/x/dolmama.jpg",
            isCover: true,
            credit: "Benoît Prieur, CC0",
            creditUrl: "https://commons.wikimedia.org/wiki/File:Dolmama.jpg",
          },
        ],
      }) as never,
    );

    const restaurant = await getRestaurant("dolmama");

    expect(restaurant).toMatchObject({
      isDemoListing: true,
      priceLevel: null,
      osmUrl: "https://www.openstreetmap.org/node/6566646015",
      photos: [
        {
          url: "https://res.cloudinary.com/x/dolmama.jpg",
          isCover: true,
          credit: "Benoît Prieur, CC0",
          creditUrl: "https://commons.wikimedia.org/wiki/File:Dolmama.jpg",
        },
      ],
    });
    expect(Object.keys(restaurant)).not.toContain("osmRef");
  });

  test("any other restaurant has no OpenStreetMap place, even with one set", async () => {
    findUnique.mockResolvedValue(detailRow({ osmRef: "node/1" }) as never);

    const restaurant = await getRestaurant("tsiran-wine-room");

    expect(restaurant).toMatchObject({ isDemoListing: false, osmUrl: null });
  });
});

describe("googleMapsUrl", () => {
  test("searches for the name and address, which Maps understands without a key", () => {
    const url = new URL(
      googleMapsUrl({
        name: "Sevan & Salt",
        address: "8 Gai Avenue, Yerevan",
        googlePlaceId: null,
      }),
    );

    expect(url.origin + url.pathname).toBe("https://www.google.com/maps/search/");
    expect(url.searchParams.get("api")).toBe("1");
    // The & in the name stays part of the search instead of starting a new parameter.
    expect(url.searchParams.get("query")).toBe("Sevan & Salt, 8 Gai Avenue, Yerevan");
    expect(url.searchParams.has("query_place_id")).toBe(false);
  });

  test("adds the place id when there is one, so Maps opens that exact place", () => {
    const url = new URL(
      googleMapsUrl({ name: "Nurr", address: "14 Pushkin Street", googlePlaceId: "ChIJ123" }),
    );

    expect(url.searchParams.get("query_place_id")).toBe("ChIJ123");
  });
});

describe("listFeatured", () => {
  test("the chosen ones, then the first others by name, from published restaurants only, with the total", async () => {
    findMany
      .mockResolvedValueOnce([
        summaryRow({ slug: "dolmama", name: "Dolmama" }),
        summaryRow({ slug: "gustav", name: "Gustav" }),
      ] as never)
      .mockResolvedValueOnce([summaryRow({ slug: "abovyan-12", name: "Abovyan 12" })] as never);
    count.mockResolvedValue(16 as never);

    const featured = await listFeatured();

    expect(featured.data.map(({ slug }) => slug)).toEqual(["gustav", "dolmama", "abovyan-12"]);
    expect(featured.meta).toEqual({ page: 1, pageSize: 3, total: 16 });
    const [chosen, byName] = findMany.mock.calls.map(([query]) => query as Record<string, unknown>);
    expect(chosen?.["where"]).toEqual({
      isPublished: true,
      hiddenAt: null,
      slug: { in: ["gustav", "paul", "dolmama"] },
    });
    expect(byName).toMatchObject({
      where: { isPublished: true, hiddenAt: null, slug: { notIn: ["gustav", "paul", "dolmama"] } },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: 3,
    });
    expect(count).toHaveBeenCalledWith({ where: { isPublished: true, hiddenAt: null } });
  });
});
