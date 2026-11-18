// The fictional restaurants' demo photos (prisma/demo-photos): which photos they are, and how adding
// them treats a database, here with a fake one. On real PostgreSQL: tests/db/demo-photos.test.ts.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { describe, expect, test, vi } from "vitest";

import { addDemoPhotos } from "../prisma/demo-photos/add-photos.ts";
import { DEMO_PHOTOS, demoPhotoRows } from "../prisma/demo-photos/photos.ts";
import { RESTAURANTS } from "../prisma/seed-data.ts";
import type { PrismaClient } from "../src/generated/prisma/client.ts";
import { isLocalPhoto } from "../src/modules/photos/local-photos.ts";

const SLUGS = Object.keys(DEMO_PHOTOS);
const PUBLIC = new URL("../../frontend/public/", import.meta.url);
const file = (url: string): URL => new URL(`.${url}`, PUBLIC);

describe("the demo photos", () => {
  test("belong to the six published fictional restaurants the seed adds, and to no real place", () => {
    const published = RESTAURANTS.filter(({ isPublished }) => isPublished).map(({ slug }) => slug);
    expect(SLUGS.toSorted()).toEqual(published.toSorted());
  });

  test("each restaurant's room comes first, as its cover, then three or four of its food", () => {
    for (const slug of SLUGS) {
      const rows = demoPhotoRows(slug);
      // The cover and four more is what a restaurant's page shows.
      expect(rows.length).toBeGreaterThanOrEqual(4);
      expect(rows.length).toBeLessThanOrEqual(5);
      expect(rows.map(({ isCover }) => isCover)).toEqual(rows.map((_, index) => index === 0));
      expect(rows.map(({ sortOrder }) => sortOrder)).toEqual(rows.map((_, index) => index));
    }
  });

  test("every photo is a WebP file in the frontend, credited to its photographer at Unsplash", () => {
    const rows = SLUGS.flatMap((slug) => demoPhotoRows(slug));
    for (const { publicId, url, credit, creditUrl } of rows) {
      expect(isLocalPhoto(publicId)).toBe(true);
      expect(url).toMatch(/^\/demo-photos\/[a-z-]+\/\d\.webp$/);
      const bytes = readFileSync(file(url));
      expect(bytes.subarray(0, 4).toString("latin1")).toBe("RIFF");
      expect(bytes.subarray(8, 12).toString("latin1")).toBe("WEBP");
      // Small enough for a card: they're 1600 or 1200 pixels wide.
      expect(statSync(file(url)).size).toBeLessThan(500_000);
      expect(credit.trim()).not.toBe("");
      expect(creditUrl).toMatch(/^https:\/\/unsplash\.com\/photos\/[\w-]+$/);
    }
    expect(new Set(rows.map(({ publicId }) => publicId)).size).toBe(rows.length);
  });

  test("the folder holds these photos and nothing else", () => {
    const listed = SLUGS.flatMap((slug) => demoPhotoRows(slug).map(({ url }) => url.slice(1)));
    const onDisk = readdirSync(new URL("./demo-photos/", PUBLIC), { recursive: true })
      .map((entry) => `demo-photos/${String(entry)}`)
      .filter((entry) => entry.endsWith(".webp"));
    expect(onDisk.toSorted()).toEqual(listed.toSorted());
  });

  test("a restaurant without demo photos, such as a real one, has none", () => {
    expect(demoPhotoRows("dolmama")).toEqual([]);
  });
});

/** A database holding these restaurants, each with photos of these publicIds. */
function fakeDatabase(restaurants: Record<string, string[]>) {
  const tx = {
    restaurant: {
      findUnique: vi.fn(({ where: { slug } }: { where: { slug: string } }) => {
        const photos = restaurants[slug];
        return Promise.resolve(
          photos ? { id: `id-${slug}`, photos: photos.map((publicId) => ({ publicId })) } : null,
        );
      }),
    },
    restaurantPhoto: { deleteMany: vi.fn(), upsert: vi.fn() },
  };
  const $transaction = vi.fn((work: (client: typeof tx) => unknown) => work(tx));
  return { tx, $transaction, db: { $transaction } as unknown as PrismaClient };
}

describe("addDemoPhotos", () => {
  test("gives a restaurant with no photos its demo photos, the cover first, and reports the rest", async () => {
    const { tx, db } = fakeDatabase({ "lori-smokehouse": [] });

    const report = await addDemoPhotos(db);

    expect(report).toEqual({
      added: ["lori-smokehouse"],
      ownPhotos: [],
      missing: SLUGS.filter((slug) => slug !== "lori-smokehouse"),
    });
    expect(tx.restaurantPhoto.upsert).toHaveBeenCalledTimes(5);
    const photo = {
      url: "/demo-photos/lori-smokehouse/1.webp",
      isCover: true,
      sortOrder: 0,
      credit: "amin ramezani",
      creditUrl: "https://unsplash.com/photos/afOvuzIgxPU",
    };
    expect(tx.restaurantPhoto.upsert).toHaveBeenNthCalledWith(1, {
      where: { publicId: "local/demo-photos/lori-smokehouse/1" },
      update: photo,
      create: {
        ...photo,
        publicId: "local/demo-photos/lori-smokehouse/1",
        restaurantId: "id-lori-smokehouse",
      },
    });
  });

  test("leaves a restaurant with a photo of its own exactly as it is", async () => {
    const { tx, db } = fakeDatabase({
      nurr: ["seghan/restaurants/id-nurr/1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"],
    });

    const report = await addDemoPhotos(db);

    expect(report.ownPhotos).toEqual(["nurr"]);
    expect(report.added).toEqual([]);
    expect(tx.restaurantPhoto.deleteMany).not.toHaveBeenCalled();
    expect(tx.restaurantPhoto.upsert).not.toHaveBeenCalled();
  });

  test("run again, it removes only demo photos the list no longer has", async () => {
    const { tx, db } = fakeDatabase({
      nurr: ["local/demo-photos/nurr/1", "local/demo-photos/nurr/5"],
    });

    await addDemoPhotos(db);

    expect(tx.restaurantPhoto.deleteMany).toHaveBeenCalledWith({
      where: {
        restaurantId: "id-nurr",
        publicId: {
          startsWith: "local/demo-photos/",
          notIn: [1, 2, 3, 4].map((n) => `local/demo-photos/nurr/${n}`),
        },
      },
    });
    expect(tx.restaurantPhoto.upsert).toHaveBeenCalledTimes(4);
  });

  test("works in one transaction, with time for the public demo's remote database", async () => {
    const { $transaction, db } = fakeDatabase({});

    await addDemoPhotos(db);

    expect($transaction).toHaveBeenCalledOnce();
    expect($transaction).toHaveBeenCalledWith(expect.any(Function), { timeout: 120_000 });
  });
});
