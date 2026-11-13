// Collecting the demo listings (prisma/demo-listings/collect-listings.ts, task 9.7), with
// OpenStreetMap and Wikimedia Commons replaced: one request for every photo, and a place that can't
// be listed, or whose page address clashes, is left out whole, with its reasons.
import { expect, test, vi } from "vitest";

import { collectListings } from "../prisma/demo-listings/collect-listings.ts";
import type { OsmPlace } from "../src/integrations/geoapify/places.ts";
import type { CommonsPhoto } from "../src/integrations/wikimedia/commons.ts";

const place = (osmRef: string, nameEn: string, extra: Partial<OsmPlace> = {}): OsmPlace => ({
  osmRef,
  nameEn,
  name: nameEn,
  street: "Pushkin Street",
  housenumber: "10",
  ownAddress: true,
  district: "Kentron",
  cuisine: "armenian",
  openingHours: "Mo-Su 11:00-00:00",
  phone: null,
  website: null,
  checkDate: null,
  ...extra,
});
const photo = (title: string): CommonsPhoto => ({
  title,
  pageUrl: `https://commons.wikimedia.org/wiki/${title}`,
  imageUrl: `https://upload.wikimedia.org/${title}`,
  width: 2000,
  author: "Benoît Prieur",
  license: "CC0",
});

const PLACES: Record<string, OsmPlace> = {
  "node/1": place("node/1", "Dolmama"),
  "node/2": place("node/2", "Tavern Yerevan"),
  "node/3": place("node/3", "Tavern Yerevan"),
  "node/4": place("node/4", "Kilikia", { cuisine: null }),
};

test("every photo in one request, each place looked up, and the good ones listed", async () => {
  const lookups = {
    place: vi.fn(async (osmRef: string) => PLACES[osmRef] ?? null),
    photos: vi.fn(async (titles: string[]) => titles.map(photo)),
  };

  const collected = await collectListings(
    [
      { osm: "node/1", photos: ["File:A.jpg"] },
      { osm: "node/2", slug: "tavern-yerevan-king-pap-street", photos: ["File:B.jpg"] },
      { osm: "node/3", photos: [] },
    ],
    lookups,
  );

  expect(lookups.photos.mock.calls).toEqual([[["File:A.jpg", "File:B.jpg"]]]);
  expect(lookups.place.mock.calls).toEqual([["node/1"], ["node/2"], ["node/3"]]);
  expect(collected.listings.map(({ slug }) => slug)).toEqual([
    "dolmama",
    "tavern-yerevan-king-pap-street",
    "tavern-yerevan",
  ]);
  expect(collected.refused).toEqual([]);
});

test("one named twice and a later clashing address are left out whole; one with no cuisine is kept", async () => {
  const collected = await collectListings(
    [
      { osm: "node/1", photos: [] },
      { osm: "node/1", photos: [] },
      { osm: "node/2", photos: [] },
      { osm: "node/3", photos: [] },
      { osm: "node/4", photos: [] },
    ],
    { place: async (osmRef) => PLACES[osmRef] ?? null, photos: async () => [] },
  );

  // The first Tavern Yerevan keeps its address; the second needs a `slug` of its own. Kilikia has
  // no cuisine in OpenStreetMap, so it's listed without one, and the reviewer is told.
  expect(collected.listings.map(({ osmRef }) => osmRef)).toEqual(["node/2", "node/4"]);
  expect(collected.listings[1]?.missing).toEqual(["cuisine", "photos"]);
  expect(collected.refused).toEqual([
    { source: "node/1", problems: ["named twice"] },
    { source: "node/1", problems: ["its address, dolmama, is taken"] },
    { source: "node/3", problems: ["its address, tavern-yerevan, is taken"] },
  ]);
});

test("a place not in OpenStreetMap isn't looked up there, and only Commons photos are asked for", async () => {
  const lookups = {
    place: vi.fn(async (osmRef: string) => PLACES[osmRef] ?? null),
    photos: vi.fn(async (titles: string[]) => titles.map(photo)),
  };
  const page = "https://www.yasaman.am/";
  const own = {
    url: "https://www.yasaman.am/hall.jpg",
    page,
    credit: "Yasaman’s website",
    width: 2000,
  };

  const collected = await collectListings(
    [
      {
        photos: [own, "File:C.jpg"],
        name: { value: "Yasaman", sources: [page] },
        address: { value: "1/1 Yekmalyan Street, Yerevan", sources: [page] },
        district: { value: "KENTRON", sources: [page] },
      },
    ],
    lookups,
  );

  expect(lookups.place).not.toHaveBeenCalled();
  expect(lookups.photos.mock.calls).toEqual([[["File:C.jpg"]]]);
  expect(
    collected.listings.map(({ slug, osmRef, photos }) => [
      slug,
      osmRef,
      photos.map(({ freeLicense }) => freeLicense),
    ]),
  ).toEqual([["yasaman", null, [false, true]]]);
  expect(collected.refused).toEqual([]);
});
