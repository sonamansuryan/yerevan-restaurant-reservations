// Importing demo listings, on real PostgreSQL (task 9.7), with Cloudinary replaced: listings are
// added with their hours and credited photos, can be found but never booked, and importing again
// changes only what the file changed, copying nothing twice and touching nothing else. A place
// that isn't in OpenStreetMap is found again by its slug, which a restaurant on Seghan never shares.
// Run with: npm run test:db -w backend
import request from "supertest";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";

import { importListings } from "../../prisma/demo-listings/import-listings.ts";
import type { ListingsFile } from "../../prisma/demo-listings/import-listings.ts";
import { LISTINGS_OWNER, photoPublicId } from "../../prisma/demo-listings/rules.ts";
import { app } from "../../src/app.ts";
import { prisma } from "../../src/lib/prisma.ts";
import { addDays, localDate } from "../../src/lib/time.ts";
import { ACCESS_COOKIE } from "../../src/modules/auth/auth.cookies.ts";
import { signAccessToken } from "../../src/modules/auth/token.service.ts";
import { addRestaurant, emptyTestDatabase } from "./test-database.ts";
import type { TestRestaurant } from "./test-database.ts";

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const photo = (title: string, credit = "Benoît Prieur, CC0") => ({
  title,
  imageUrl: `https://upload.wikimedia.org/wikipedia/commons/thumb/${title.slice(5)}`,
  pageUrl: `https://commons.wikimedia.org/wiki/${title}`,
  credit,
  freeLicense: true as const,
});
const OSM = "https://www.openstreetmap.org/node/6566646015";
const dolmama = {
  osmRef: "node/6566646015",
  slug: "dolmama",
  name: "Dolmama",
  cuisines: ["ARMENIAN" as const],
  district: "KENTRON" as const,
  address: "10 Pushkin Street, Yerevan",
  phone: "+374 10 56 13 54",
  website: "https://www.dolmama.am/",
  description: null,
  openingHours: EVERY_DAY.map((dayOfWeek) => ({ dayOfWeek, opensAt: 660, closesAt: 1440 })),
  openingHoursText: "Mo-Su 11:00-00:00",
  checkDate: "2024-10-17",
  photos: [photo("File:Entrance.jpg"), photo("File:Room.jpg", "Sebleouf, CC BY-SA 4.0")],
  tables: [
    { label: "T1", capacity: 2, minCapacity: 1, zone: "INDOOR" as const },
    { label: "T2", capacity: 4, minCapacity: 2, zone: "TERRACE" as const },
  ],
  detailSources: { name: [OSM], address: [OSM], district: [OSM] },
  missing: [],
};
// A listing no source gives everything for: no cuisine, no hours and no photo, its address from
// the restaurant's own page.
const mayrig = {
  ...dolmama,
  osmRef: "node/6213329732",
  slug: "mayrig",
  name: "Mayrig",
  cuisines: [],
  address: "4/6 King Pap Street, Yerevan",
  website: null,
  openingHours: [],
  openingHoursText: "",
  photos: [],
  detailSources: { address: ["https://example.com/mayrig/contact"] },
  missing: ["opening hours", "cuisine", "photos"],
};
// A place that isn't in OpenStreetMap, from details checked by hand, with a photo from its own site.
const YASAMAN_SITE = "https://www.yasaman.example/";
const yasaman = {
  ...dolmama,
  osmRef: null,
  slug: "yasaman",
  name: "Yasaman",
  address: "1/1 Yekmalyan Street, Yerevan",
  website: YASAMAN_SITE,
  description: "Armenian dishes and live music in the centre.",
  checkDate: null,
  photos: [
    {
      title: `${YASAMAN_SITE}hall.jpg`,
      imageUrl: `${YASAMAN_SITE}hall.jpg`,
      pageUrl: YASAMAN_SITE,
      credit: "Yasaman’s website",
      freeLicense: false as const,
    },
  ],
  detailSources: { name: [YASAMAN_SITE], address: [YASAMAN_SITE], district: [YASAMAN_SITE] },
};
const FILE: ListingsFile = { listings: [dolmama, mayrig, yasaman] };

// Cloudinary, replaced: each copy gets a version, as Cloudinary's answer would.
const copyPhoto = vi.fn(async (_sourceUrl: string, publicId: string) => ({
  publicId,
  url: `https://res.cloudinary.com/test-cloud/image/upload/v1/${publicId}`,
}));

// A week from today in Yerevan: always more than an hour away, and within the 60 days.
const DATE = addDays(localDate(new Date(), "Asia/Yerevan"), 7);

let lori: TestRestaurant;

const tableId = async (slug: string, label: string): Promise<string> =>
  (
    await prisma.table.findFirstOrThrow({
      where: { label, restaurant: { slug } },
      select: { id: true },
    })
  ).id;

/** Lori's guest books a table at 19:00, as anyone does, through the API. */
async function book(table: string, partySize: number) {
  const token = await signAccessToken({ id: lori.guestId, role: "CUSTOMER" });
  return request(app)
    .post("/api/reservations")
    .set("Cookie", `${ACCESS_COOKIE}=${token}`)
    .send({ tableId: table, date: DATE, time: "19:00", partySize });
}

beforeEach(async () => {
  await emptyTestDatabase();
  copyPhoto.mockClear();
  // An ordinary restaurant, which the import must leave alone.
  lori = await addRestaurant();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const listing = (slug: string) =>
  prisma.restaurant.findUniqueOrThrow({
    where: { slug },
    include: {
      owner: { select: { email: true, role: true, passwordHash: true, googleId: true } },
      openingHours: { orderBy: { dayOfWeek: "asc" } },
      photos: { orderBy: { sortOrder: "asc" } },
      tables: true,
    },
  });

describe("the first import", () => {
  test("adds each listing, demo-marked and priceless, owned by an account nobody can sign in to", async () => {
    const report = await importListings(prisma, FILE, copyPhoto);

    expect(report).toEqual({
      added: ["dolmama", "mayrig", "yasaman"],
      updated: [],
      unpublished: [],
      photosCopied: 3,
    });
    const row = await listing("dolmama");
    expect(row).toMatchObject({
      name: "Dolmama",
      osmRef: "node/6566646015",
      isDemoListing: true,
      isPublished: true,
      priceLevel: null,
      cuisines: ["ARMENIAN"],
      district: "KENTRON",
      timezone: "Asia/Yerevan",
      owner: { email: LISTINGS_OWNER.email, role: "OWNER", passwordHash: null, googleId: null },
      // Its sample tables, so it can be booked to try Seghan out.
      tables: [
        { label: "T1", capacity: 2, minCapacity: 1, zone: "INDOOR", isActive: true },
        { label: "T2", capacity: 4, minCapacity: 2, zone: "TERRACE", isActive: true },
      ],
    });
    expect(
      row.openingHours.map(({ dayOfWeek, opensAt, closesAt }) => [dayOfWeek, opensAt, closesAt]),
    ).toEqual(EVERY_DAY.map((day) => [day, 660, 1440]));
    expect(
      row.photos.map(({ publicId, isCover, credit, creditUrl }) => ({
        publicId,
        isCover,
        credit,
        creditUrl,
      })),
    ).toEqual([
      {
        publicId: photoPublicId("node/6566646015", "File:Entrance.jpg"),
        isCover: true,
        credit: "Benoît Prieur, CC0",
        creditUrl: "https://commons.wikimedia.org/wiki/File:Entrance.jpg",
      },
      {
        publicId: photoPublicId("node/6566646015", "File:Room.jpg"),
        isCover: false,
        credit: "Sebleouf, CC BY-SA 4.0",
        creditUrl: "https://commons.wikimedia.org/wiki/File:Room.jpg",
      },
    ]);
    // Cloudinary is asked to fetch each photo from Commons itself.
    expect(copyPhoto).toHaveBeenCalledWith(
      "https://upload.wikimedia.org/wikipedia/commons/thumb/Entrance.jpg",
      photoPublicId("node/6566646015", "File:Entrance.jpg"),
    );
  });

  test("a place not in OpenStreetMap is added by its slug, described, its own photo credited to its site", async () => {
    await importListings(prisma, FILE, copyPhoto);

    const row = await listing("yasaman");
    expect(row).toMatchObject({
      osmRef: null,
      isDemoListing: true,
      description: "Armenian dishes and live music in the centre.",
      tables: [{ label: "T1" }, { label: "T2" }],
    });
    expect(
      row.photos.map(({ publicId, credit, creditUrl }) => ({ publicId, credit, creditUrl })),
    ).toEqual([
      {
        publicId: photoPublicId("yasaman", `${YASAMAN_SITE}hall.jpg`),
        credit: "Yasaman’s website",
        creditUrl: YASAMAN_SITE,
      },
    ]);
    expect(copyPhoto).toHaveBeenCalledWith(
      `${YASAMAN_SITE}hall.jpg`,
      photoPublicId("yasaman", `${YASAMAN_SITE}hall.jpg`),
    );
  });

  test("a restaurant on Seghan with a listing's slug stops the import before anything is written", async () => {
    await prisma.restaurant.update({ where: { id: lori.restaurantId }, data: { slug: "yasaman" } });
    const before = await prisma.restaurant.findUniqueOrThrow({ where: { id: lori.restaurantId } });

    await expect(importListings(prisma, FILE, copyPhoto)).rejects.toThrow(
      "A restaurant on Seghan already has the address yasaman.",
    );
    expect(copyPhoto).not.toHaveBeenCalled();
    expect(await prisma.restaurant.count({ where: { isDemoListing: true } })).toBe(0);
    expect(await prisma.restaurant.findUniqueOrThrow({ where: { id: lori.restaurantId } })).toEqual(
      before,
    );
  });

  test("the listing account can't sign in, and the ordinary restaurant is untouched", async () => {
    const before = await prisma.restaurant.findUniqueOrThrow({ where: { id: lori.restaurantId } });

    await importListings(prisma, FILE, copyPhoto);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: LISTINGS_OWNER.email, password: "any password at all" });
    expect(login.status).toBe(401);
    expect(await prisma.restaurant.findUniqueOrThrow({ where: { id: lori.restaurantId } })).toEqual(
      before,
    );
  });
});

describe("guests", () => {
  beforeEach(async () => {
    await importListings(prisma, FILE, copyPhoto);
  });

  test("find it on Browse, marked, with no price, and a price filter leaves it out", async () => {
    const all = await request(app).get("/api/restaurants");
    const priced = await request(app).get("/api/restaurants?price=2");

    expect(
      all.body.data.map(({ slug, isDemoListing, priceLevel }: Record<string, unknown>) => [
        slug,
        isDemoListing,
        priceLevel,
      ]),
    ).toEqual([
      ["dolmama", true, null],
      ["lori-smokehouse", false, 2],
      ["mayrig", true, null],
      ["yasaman", true, null],
    ]);
    expect(priced.body.data.map(({ slug }: { slug: string }) => slug)).toEqual(["lori-smokehouse"]);
  });

  test("one with details missing still shows: no cuisine, no hours and no photo, rather than guesses", async () => {
    const page = await request(app).get("/api/restaurants/mayrig");

    expect(page.status).toBe(200);
    expect(page.body.restaurant).toMatchObject({
      isDemoListing: true,
      cuisines: [],
      openingHours: [],
      photos: [],
      coverPhotoUrl: null,
      priceLevel: null,
      address: "4/6 King Pap Street, Yerevan",
    });
  });

  test("see its page with its OpenStreetMap place and credited photos, and book a sample table", async () => {
    const page = await request(app).get("/api/restaurants/dolmama");
    const times = await request(app).get(
      `/api/restaurants/dolmama/availability?date=${DATE}&partySize=2`,
    );

    expect(page.body.restaurant).toMatchObject({
      isDemoListing: true,
      osmUrl: "https://www.openstreetmap.org/node/6566646015",
      photos: [
        { isCover: true, credit: "Benoît Prieur, CC0" },
        { isCover: false, credit: "Sebleouf, CC BY-SA 4.0" },
      ],
    });
    // Its times come from its hours, and its sample tables are free at them.
    expect(times.status).toBe(200);
    const seven = times.body.slots.find(({ starts }: { starts: string }) => starts === "19:00");
    expect(seven.tables.map(({ label }: { label: string }) => label)).toEqual(["T1", "T2"]);
    // Booked like any restaurant on Seghan, through the same checks and locks.
    const booked = await book(await tableId("dolmama", "T2"), 4);
    expect(booked.status).toBe(201);
    expect(booked.body.reservation).toMatchObject({ status: "PENDING", partySize: 4 });
  });
});

describe("importing again", () => {
  test("copies nothing twice, and leaves every row as it was", async () => {
    await importListings(prisma, FILE, copyPhoto);
    copyPhoto.mockClear();
    const before = await listing("dolmama");

    const report = await importListings(prisma, FILE, copyPhoto);

    expect(report).toEqual({
      added: [],
      updated: ["dolmama", "mayrig", "yasaman"],
      unpublished: [],
      photosCopied: 0,
    });
    expect(copyPhoto).not.toHaveBeenCalled();
    const after = await listing("dolmama");
    expect(after.photos.map(({ id }) => id)).toEqual(before.photos.map(({ id }) => id));
    expect(after.openingHours).toHaveLength(7);
    expect(await prisma.restaurant.count({ where: { isDemoListing: true } })).toBe(3);
  });

  test("changes what the file changed: hours, photos, and a listing that left is unpublished, not deleted", async () => {
    await importListings(prisma, FILE, copyPhoto);
    copyPhoto.mockClear();

    const report = await importListings(
      prisma,
      {
        listings: [
          {
            ...dolmama,
            openingHours: [{ dayOfWeek: 5, opensAt: 1080, closesAt: 1560 }],
            photos: [photo("File:Room.jpg", "Sebleouf, CC BY-SA 4.0"), photo("File:Food.jpg")],
          },
        ],
      },
      copyPhoto,
    );

    expect({ ...report, unpublished: report.unpublished.toSorted() }).toEqual({
      added: [],
      updated: ["dolmama"],
      // Found by its OpenStreetMap id, or by its slug when it isn't there.
      unpublished: ["mayrig", "yasaman"],
      photosCopied: 1,
    });
    const row = await listing("dolmama");
    expect(
      row.openingHours.map(({ dayOfWeek, opensAt, closesAt }) => [dayOfWeek, opensAt, closesAt]),
    ).toEqual([[5, 1080, 1560]]);
    expect(row.photos.map(({ publicId, isCover }) => [publicId, isCover])).toEqual([
      [photoPublicId("node/6566646015", "File:Room.jpg"), true],
      [photoPublicId("node/6566646015", "File:Food.jpg"), false],
    ]);
    for (const slug of ["mayrig", "yasaman"]) {
      expect(await prisma.restaurant.findUniqueOrThrow({ where: { slug } })).toMatchObject({
        isPublished: false,
        isDemoListing: true,
      });
    }
    expect((await request(app).get("/api/restaurants/mayrig")).status).toBe(404);
  });

  test("keeps its tables, and one that left the file is switched off, never deleted", async () => {
    await importListings(prisma, FILE, copyPhoto);
    const before = await listing("dolmama");

    await importListings(
      prisma,
      { listings: [{ ...dolmama, tables: dolmama.tables.slice(0, 1) }, mayrig, yasaman] },
      copyPhoto,
    );

    const after = await listing("dolmama");
    expect(after.tables.map(({ id, label, isActive }) => [id, label, isActive])).toEqual(
      before.tables.map(({ id, label }) => [id, label, label === "T1"]),
    );
  });

  test("a table an upcoming booking needs can't shrink or be switched off, and nothing changes", async () => {
    await importListings(prisma, FILE, copyPhoto);
    expect((await book(await tableId("dolmama", "T2"), 4)).status).toBe(201);
    const before = await listing("dolmama");
    const twoSeats = { ...dolmama.tables[1]!, capacity: 2, minCapacity: 1 };
    const changed = { ...dolmama, openingHours: [], tables: [dolmama.tables[0]!, twoSeats] };

    await expect(
      importListings(prisma, { listings: [changed, mayrig, yasaman] }, copyPhoto),
    ).rejects.toThrow(
      "dolmama, table T2: An upcoming booking for 4 guests needs this table. Keep at least 4 seats until it's over or cancelled.",
    );
    await expect(
      importListings(
        prisma,
        { listings: [{ ...changed, tables: [dolmama.tables[0]!] }, mayrig, yasaman] },
        copyPhoto,
      ),
    ).rejects.toThrow("dolmama, table T2: An upcoming booking still needs this table.");
    // All or nothing: its tables and its hours are as they were.
    expect(await listing("dolmama")).toEqual(before);
  });

  test("a listing Seghan's admin hid stays hidden", async () => {
    await importListings(prisma, FILE, copyPhoto);
    await prisma.restaurant.update({ where: { slug: "dolmama" }, data: { hiddenAt: new Date() } });

    await importListings(prisma, FILE, copyPhoto);

    expect((await listing("dolmama")).hiddenAt).not.toBeNull();
    expect((await request(app).get("/api/restaurants/dolmama")).status).toBe(404);
  });
});
