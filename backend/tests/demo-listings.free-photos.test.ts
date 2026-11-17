// The public demo's import keeps only freely licensed photos (PROJECT_PLAN.md 10.1): a photo from
// a restaurant's own site is left out before anything is copied, and the file is otherwise kept.
import { describe, expect, test } from "vitest";

import { withFreePhotosOnly } from "../prisma/demo-listings/import-listings.ts";
import type { ListingsFile } from "../prisma/demo-listings/import-listings.ts";

type Listing = ListingsFile["listings"][number];

const commons = (name: string) => ({
  title: `File:${name}`,
  imageUrl: `https://upload.wikimedia.org/wikipedia/commons/${name}`,
  pageUrl: `https://commons.wikimedia.org/wiki/File:${name}`,
  credit: "Benoît Prieur, CC0",
  freeLicense: true as const,
});
const ownSite = (address: string) => ({
  title: address,
  imageUrl: address,
  pageUrl: "https://restaurant.example/",
  credit: "The restaurant’s website",
  freeLicense: false as const,
});

const listingWith = (slug: string, photos: Listing["photos"]): Listing => ({
  osmRef: null,
  slug,
  name: slug,
  cuisines: [],
  district: "KENTRON",
  address: "1 Abovyan Street, Yerevan",
  phone: null,
  website: null,
  description: null,
  openingHours: [],
  photos,
  tables: [{ label: "T1", capacity: 2, minCapacity: 1, zone: "INDOOR" }],
  openingHoursText: "",
  checkDate: null,
  detailSources: {},
  missing: [],
});

describe("withFreePhotosOnly", () => {
  const file: ListingsFile = {
    listings: [
      // Its own photo first, so the first free one has to become the cover.
      listingWith("mixed", [
        ownSite("https://restaurant.example/hall.jpg"),
        commons("Room.jpg"),
        commons("Entrance.jpg"),
      ]),
      listingWith("own-only", [ownSite("https://restaurant.example/terrace.jpg")]),
      listingWith("none", []),
    ],
  };

  test("keeps only the Commons photos, in their order, and counts both", () => {
    const result = withFreePhotosOnly(file);

    expect(result.file.listings.map(({ photos }) => photos.map(({ title }) => title))).toEqual([
      ["File:Room.jpg", "File:Entrance.jpg"],
      [],
      [],
    ]);
    expect(result.kept).toBe(2);
    expect(result.leftOut).toBe(2);
  });

  test("keeps every listing and everything but the photos, and doesn't change the file", () => {
    const result = withFreePhotosOnly(file);

    expect(result.file.listings.map(({ slug }) => slug)).toEqual(["mixed", "own-only", "none"]);
    expect({ ...result.file.listings[0], photos: [] }).toEqual({ ...file.listings[0], photos: [] });
    expect(file.listings[0]?.photos).toHaveLength(3);
  });
});
