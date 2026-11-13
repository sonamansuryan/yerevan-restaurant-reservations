// The demo listings' sources (prisma/demo-listings/sources.ts, task 9.7) and, once collected, the
// reviewed file the import reads (listings.json): well formed, within the limits, every detail
// checked by hand naming its pages, and every photo credited.
import { existsSync, readFileSync } from "node:fs";

import { expect, test } from "vitest";

import { listingsFileSchema } from "../prisma/demo-listings/import-listings.ts";
import {
  listingKey,
  MAX_LISTINGS,
  MAX_PHOTOS,
  MIN_PHOTO_WIDTH,
  photoPublicId,
  sourceKey,
} from "../prisma/demo-listings/rules.ts";
import type { Checked } from "../prisma/demo-listings/rules.ts";
import { SOURCES } from "../prisma/demo-listings/sources.ts";

test("each place once, in OpenStreetMap or checked by hand, with a few photos at most", () => {
  const keys = SOURCES.map(sourceKey);

  expect(new Set(keys).size).toBe(keys.length);
  expect(keys.length).toBeLessThanOrEqual(MAX_LISTINGS);
  for (const source of SOURCES) {
    if (source.osm) expect(source.osm).toMatch(/^(node|way|relation)\/\d+$/);
    // A place that isn't in OpenStreetMap needs these three checked by hand.
    else expect([source.name, source.address, source.district]).not.toContain(undefined);
    expect(source.photos.length).toBeLessThanOrEqual(MAX_PHOTOS);
    // Every listing can be booked to try Seghan out.
    expect(Object.values(source.tables ?? {}).flat().length, sourceKey(source)).toBeGreaterThan(0);
    for (const photo of source.photos) {
      if (typeof photo === "string") {
        expect(photo).toMatch(/^File:.+\.(jpe?g|png|webp)$/i);
      } else {
        expect(photo.url).toMatch(/^https:\/\//);
        expect(photo.page).toMatch(/^https:\/\//);
        expect(photo.credit.trim()).not.toBe("");
        expect(photo.width).toBeGreaterThanOrEqual(MIN_PHOTO_WIDTH);
      }
    }
  }
});

test("every detail checked by hand names at least one page that says it", () => {
  for (const source of SOURCES) {
    const checked: (Checked<unknown> | undefined)[] = [
      source.name,
      source.address,
      source.district,
      source.cuisines,
      source.openingHours,
      source.phone,
      source.website,
    ];
    for (const detail of checked.filter((one) => one !== undefined)) {
      expect(detail.sources.length, sourceKey(source)).toBeGreaterThan(0);
      for (const page of detail.sources) expect(page).toMatch(/^https:\/\//);
    }
  }
});

test("Gustav's cover keeps the public ID the frontend shows whole (features/restaurants/covers.ts)", () => {
  const cover = SOURCES.find(({ osm }) => osm === "node/12246284869")?.photos[0];
  const title = typeof cover === "string" ? cover : cover?.url;

  expect(photoPublicId("node/12246284869", title ?? "")).toBe(
    "seghan/demo-listings/node-12246284869/466cc90a3f0cb4a9",
  );
});

const FILE = new URL("../prisma/demo-listings/listings.json", import.meta.url);

test.runIf(existsSync(FILE))(
  "listings.json is what the import accepts, for each source at most, every photo credited, in the sources' order",
  () => {
    const { listings } = listingsFileSchema.parse(JSON.parse(readFileSync(FILE, "utf8")));

    for (const listing of listings) {
      const source = SOURCES.find((one) => sourceKey(one) === (listing.osmRef ?? listing.slug));
      expect(source, listing.slug).toBeDefined();
      // The cover is the first photo the sources name, so a file edited by hand keeps their order.
      const titles = listing.photos.map(({ title }) => title);
      const named = (source?.photos ?? []).map((photo) =>
        typeof photo === "string" ? photo : photo.url,
      );
      expect(titles, listing.slug).toEqual(named.filter((title) => titles.includes(title)));
      for (const photo of listing.photos) {
        // A Commons photo is credited with its license; a restaurant's own, with its site.
        if (photo.freeLicense) expect(photo.credit).toMatch(/, (CC0|Public domain|CC BY)/);
        else expect(photo.credit).toMatch(/website$/);
      }
    }
    expect(new Set(listings.map(listingKey)).size).toBe(listings.length);
  },
);
