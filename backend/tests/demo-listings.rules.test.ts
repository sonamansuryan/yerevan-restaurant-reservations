// The rules for Seghan's demo listings (prisma/demo-listings/rules.ts, task 9.7): what OpenStreetMap,
// Wikimedia Commons and details checked by hand say, turned into a listing, or every reason a place
// can't be one.
import { describe, expect, test } from "vitest";

import type { OsmPlace } from "../src/integrations/geoapify/places.ts";
import type { CommonsPhoto } from "../src/integrations/wikimedia/commons.ts";
import {
  addressFrom,
  creditFrom,
  cuisinesFrom,
  districtFrom,
  isFreeLicense,
  listingFrom,
  listingKey,
  MAX_PHOTOS,
  openingHoursFrom,
  osmUrl,
  photoPublicId,
  slugFrom,
  sourceKey,
  tablesFrom,
} from "../prisma/demo-listings/rules.ts";
import type { ListingSource, OwnPhoto } from "../prisma/demo-listings/rules.ts";

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const daily = (opensAt: number, closesAt: number) =>
  EVERY_DAY.map((dayOfWeek) => ({ dayOfWeek, opensAt, closesAt }));

describe("openingHoursFrom", () => {
  test.each([
    ["Mo-Su 11:00-00:00", daily(660, 1440)],
    ["09:30-24:00", daily(570, 1440)],
    ["24/7", daily(0, 1440)],
    // Past midnight counts on from the same day, as an owner's own hours do.
    ["Mo-Su 18:00-02:00", daily(1080, 1560)],
  ])("%s", (text, week) => {
    expect(openingHoursFrom(text)).toEqual(week);
  });

  test("a later rule replaces an earlier one for the days it names, and off closes a day", () => {
    expect(openingHoursFrom("Mo-Su 10:00-22:00; Su 12:00-20:00; Mo off")).toEqual([
      { dayOfWeek: 0, opensAt: 720, closesAt: 1200 },
      ...[2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, opensAt: 600, closesAt: 1320 })),
    ]);
  });

  test("split shifts, day lists, a comma before a day, colons, dashes and public holidays", () => {
    expect(openingHoursFrom("Sa,Su 12:00-15:00,18:00-23:00")).toEqual([
      { dayOfWeek: 0, opensAt: 720, closesAt: 900 },
      { dayOfWeek: 0, opensAt: 1080, closesAt: 1380 },
      { dayOfWeek: 6, opensAt: 720, closesAt: 900 },
      { dayOfWeek: 6, opensAt: 1080, closesAt: 1380 },
    ]);
    expect(openingHoursFrom("Mo-Fr: 08:00-23:00, Sa–Su: 09:00-23:00")).toEqual([
      { dayOfWeek: 0, opensAt: 540, closesAt: 1380 },
      ...[1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, opensAt: 480, closesAt: 1380 })),
      { dayOfWeek: 6, opensAt: 540, closesAt: 1380 },
    ]);
    expect(openingHoursFrom("PH,Mo-Su 09:00-21:00")).toEqual(daily(540, 1260));
  });

  test.each([
    [null],
    [""],
    // More of the format than this reads: months, sunrise, and a date.
    ["Mo-Fr 09:00-18:00; Dec 25 off"],
    ["sunrise-sunset"],
    ["Mo-Su 10:00+"],
    // Open twice at once, and every day closed.
    ["Mo 10:00-16:00,15:00-20:00"],
    ["Mo-Su off"],
    ["Mo-Su 25:00-26:00"],
  ])("%s isn't read, so the place isn't listed", (text) => {
    expect(openingHoursFrom(text)).toBeNull();
  });
});

describe("cuisinesFrom", () => {
  test("OpenStreetMap's words that match Seghan's, in order, once each", () => {
    expect(cuisinesFrom("armenian;regional;georgian")).toEqual(["ARMENIAN", "GEORGIAN"]);
    expect(cuisinesFrom("greek; steak_house;lebanese;curry")).toEqual([
      "EUROPEAN",
      "STEAKHOUSE",
      "MIDDLE_EASTERN",
      "ASIAN",
    ]);
  });

  test("no guesses: a word with no match, or none at all, adds nothing", () => {
    expect(cuisinesFrom("caucasian;international;coffee_shop")).toEqual([]);
    expect(cuisinesFrom(null)).toEqual([]);
  });
});

test("districts by name, in any spelling of the hyphen and case", () => {
  expect(districtFrom("Kentron")).toBe("KENTRON");
  expect(districtFrom("Malatia-Sebastia")).toBe("MALATIA_SEBASTIA");
  expect(districtFrom("nor nork")).toBe("NOR_NORK");
  expect(districtFrom("Tbilisi")).toBeNull();
  expect(districtFrom(null)).toBeNull();
});

test("a page's address, a street address and a photo's credit, as Seghan writes them", () => {
  expect(slugFrom("Tavern Yerevan")).toBe("tavern-yerevan");
  expect(slugFrom("Sevan & Salt")).toBe("sevan-and-salt");
  expect(slugFrom("  Café Charentsi 28 ")).toBe("cafe-charentsi-28");
  expect(addressFrom("Tumanyan street", "21")).toBe("21 Tumanyan Street, Yerevan");
  expect(addressFrom("Mesrop Mashtots avenue", "4/6")).toBe("4/6 Mesrop Mashtots Avenue, Yerevan");
  expect(creditFrom({ author: "Benoît Prieur", license: "CC0" })).toBe("Benoît Prieur, CC0");
  expect(creditFrom({ author: null, license: "CC BY-SA 4.0" })).toBe(
    "Unknown author, CC BY-SA 4.0",
  );
  expect(osmUrl("node/6566646015")).toBe("https://www.openstreetmap.org/node/6566646015");
});

test("only licenses free to reuse and store whose terms Seghan's credit meets", () => {
  for (const license of ["CC0", "Public domain", "CC BY 4.0", "CC BY-SA 4.0", "cc by-sa 4.0"]) {
    expect(isFreeLicense(license), license).toBe(true);
  }
  // Older CC versions also ask for the photo's title and the license's own link.
  for (const license of [
    "CC BY-SA 3.0",
    "CC BY 2.0",
    "CC BY-NC 4.0",
    "CC BY-ND 4.0",
    "Fair use",
    null,
  ]) {
    expect(isFreeLicense(license), String(license)).toBe(false);
  }
});

test("a photo's name at Cloudinary is fixed by its place and file, so a second import finds it", () => {
  const first = photoPublicId("node/6566646015", "File:Dolmama.jpg");

  expect(first).toMatch(/^seghan\/demo-listings\/node-6566646015\/[0-9a-f]{16}$/);
  expect(photoPublicId("node/6566646015", "File:Dolmama.jpg")).toBe(first);
  expect(photoPublicId("node/6566646015", "File:Other.jpg")).not.toBe(first);
  expect(photoPublicId("node/1", "File:Dolmama.jpg")).not.toBe(first);
  // A place that isn't in OpenStreetMap is known by its slug.
  expect(photoPublicId("yasaman", "https://example.com/hall.jpg")).toMatch(
    /^seghan\/demo-listings\/yasaman\/[0-9a-f]{16}$/,
  );
});

test("a listing is known by its OpenStreetMap id, or by its slug when it isn't there", () => {
  expect(listingKey({ osmRef: "node/1", slug: "dolmama" })).toBe("node/1");
  expect(listingKey({ osmRef: null, slug: "yasaman" })).toBe("yasaman");
  expect(sourceKey({ osm: "node/1", photos: [] })).toBe("node/1");
  expect(sourceKey({ slug: "yasaman-yerevan", photos: [] })).toBe("yasaman-yerevan");
  expect(sourceKey({ name: { value: "Yasaman", sources: [] }, photos: [] })).toBe("yasaman");
});

test("sample tables are labelled by zone as the seed's are, each for at least half its seats", () => {
  expect(
    tablesFrom({ BAR_COUNTER: [2], INDOOR: [2, 4], VIP: [10], TERRACE: [6, 8] }).map(
      ({ label, capacity, minCapacity, zone }) => `${label} ${minCapacity}-${capacity} ${zone}`,
    ),
  ).toEqual([
    // The room, then the terrace, numbered on; then a private room, and the bar.
    "T1 1-2 INDOOR",
    "T2 2-4 INDOOR",
    "T3 3-6 TERRACE",
    "T4 4-8 TERRACE",
    "V1 5-10 VIP",
    "B1 1-2 BAR_COUNTER",
  ]);
  expect(tablesFrom({})).toEqual([]);
});

describe("listingFrom", () => {
  const place: OsmPlace = {
    osmRef: "node/6566646015",
    nameEn: "Dolmama",
    name: "Դոլմամա",
    street: "Pushkin Street",
    housenumber: "10",
    ownAddress: true,
    district: "Kentron",
    cuisine: "armenian",
    openingHours: "Mo-Su 11:00-00:00",
    phone: "+374 10 56 13 54",
    website: "https://www.dolmama.am/",
    checkDate: "2024-10-17",
  };
  const photo = (title: string, extra: Partial<CommonsPhoto> = {}): CommonsPhoto => ({
    title,
    pageUrl: `https://commons.wikimedia.org/wiki/${title}`,
    imageUrl: `https://upload.wikimedia.org/thumb/${title}`,
    width: 4032,
    author: "Benoît Prieur",
    license: "CC0",
    ...extra,
  });

  const OSM = "https://www.openstreetmap.org/node/6566646015";

  test("a place with everything becomes a listing, its photos in the order named, credited", () => {
    const result = listingFrom({ osm: place.osmRef, photos: ["File:B.jpg", "File:A.jpg"] }, place, [
      photo("File:A.jpg"),
      photo("File:B.jpg", { author: "Sebleouf", license: "CC BY-SA 4.0" }),
    ]);

    expect(result).toEqual({
      listing: {
        osmRef: "node/6566646015",
        slug: "dolmama",
        name: "Dolmama",
        cuisines: ["ARMENIAN"],
        district: "KENTRON",
        address: "10 Pushkin Street, Yerevan",
        phone: "+374 10 56 13 54",
        website: "https://www.dolmama.am/",
        description: null,
        openingHours: daily(660, 1440),
        openingHoursText: "Mo-Su 11:00-00:00",
        checkDate: "2024-10-17",
        photos: [
          {
            title: "File:B.jpg",
            imageUrl: "https://upload.wikimedia.org/thumb/File:B.jpg",
            pageUrl: "https://commons.wikimedia.org/wiki/File:B.jpg",
            credit: "Sebleouf, CC BY-SA 4.0",
            freeLicense: true,
          },
          {
            title: "File:A.jpg",
            imageUrl: "https://upload.wikimedia.org/thumb/File:A.jpg",
            pageUrl: "https://commons.wikimedia.org/wiki/File:A.jpg",
            credit: "Benoît Prieur, CC0",
            freeLicense: true,
          },
        ],
        // Every detail from its place at OpenStreetMap.
        detailSources: {
          name: [OSM],
          address: [OSM],
          district: [OSM],
          openingHours: [OSM],
          cuisines: [OSM],
          phone: [OSM],
          website: [OSM],
        },
        tables: [],
        missing: [],
      },
    });
  });

  test("a slug in the sources wins, and no photos is kept, and named as missing", () => {
    const result = listingFrom(
      { osm: place.osmRef, slug: "dolmama-pushkin", photos: [] },
      place,
      [],
    );

    expect(result).toMatchObject({
      listing: { slug: "dolmama-pushkin", photos: [], missing: ["photos"] },
    });
  });

  test("details checked by hand come ahead of OpenStreetMap's, each with the pages that say it", () => {
    const site = "https://www.dolmama.am/";
    const spyur = "https://www.spyur.am/en/companies/1";
    const result = listingFrom(
      {
        osm: place.osmRef,
        photos: [],
        name: { value: "Dolmama Restaurant", sources: [site] },
        address: { value: "10 Pushkin Street, Yerevan", sources: [site, spyur] },
        cuisines: { value: ["ARMENIAN", "FUSION"], sources: [site] },
        openingHours: { value: "Mo-Su 11:00-23:30", sources: [site] },
        phone: { value: "+374 10 561354", sources: [spyur] },
        description: "  Armenian dishes, made new.  ",
      },
      place,
      [],
    );

    expect(result).toMatchObject({
      listing: {
        osmRef: "node/6566646015",
        name: "Dolmama Restaurant",
        slug: "dolmama-restaurant",
        cuisines: ["ARMENIAN", "FUSION"],
        openingHours: daily(660, 1410),
        openingHoursText: "Mo-Su 11:00-23:30",
        phone: "+374 10 561354",
        // Still OpenStreetMap's where nothing was checked by hand.
        website: "https://www.dolmama.am/",
        description: "Armenian dishes, made new.",
        detailSources: {
          name: [site],
          address: [site, spyur],
          district: [OSM],
          cuisines: [site],
          openingHours: [site],
          phone: [spyur],
          website: [OSM],
        },
        missing: ["photos"],
      },
    });
  });

  test("a place not in OpenStreetMap is listed from details checked by hand alone", () => {
    const visit = "https://visityerevan.am/restaurants/details/21/en/";
    const spyur = "https://www.spyur.am/en/companies/yasaman-restaurant/42087/";
    const yasaman: ListingSource = {
      photos: [],
      name: { value: "Yasaman", sources: [visit, spyur] },
      address: { value: "1/1 Yekmalyan Street, Yerevan", sources: [visit, spyur] },
      district: { value: "KENTRON", sources: [spyur] },
      cuisines: { value: ["ARMENIAN"], sources: [visit] },
      openingHours: { value: "Mo-Su 10:00-00:00", sources: [spyur] },
    };

    expect(listingFrom(yasaman, null, [])).toEqual({
      listing: {
        osmRef: null,
        slug: "yasaman",
        name: "Yasaman",
        cuisines: ["ARMENIAN"],
        district: "KENTRON",
        address: "1/1 Yekmalyan Street, Yerevan",
        phone: null,
        website: null,
        description: null,
        openingHours: daily(600, 1440),
        openingHoursText: "Mo-Su 10:00-00:00",
        checkDate: null,
        photos: [],
        detailSources: {
          name: [visit, spyur],
          address: [visit, spyur],
          district: [spyur],
          cuisines: [visit],
          openingHours: [spyur],
        },
        tables: [],
        missing: ["photos"],
      },
    });
    // Without OpenStreetMap, nothing stands in for a name, an address or a district.
    expect(listingFrom({ photos: [], name: yasaman.name }, null, [])).toEqual({
      problems: ["no address with a house number", "not in a Yerevan district: none"],
    });
  });

  test("hours checked by hand that don't read are a mistake to fix, so the place is left out", () => {
    expect(
      listingFrom(
        { osm: place.osmRef, photos: [], openingHours: { value: "daily, lunch", sources: [OSM] } },
        place,
        [],
      ),
    ).toEqual({ problems: [`opening hours "daily, lunch" don't read`] });
  });

  test("a restaurant's own photo is kept, credited to its site and marked not free; a narrow one isn't", () => {
    const own = (name: string, width = 3000): OwnPhoto => ({
      url: `https://www.dolmama.am/assets/${name}.jpg`,
      page: "https://www.dolmama.am/",
      credit: "Dolmama’s website",
      width,
    });
    const result = listingFrom(
      { osm: place.osmRef, photos: [own("room"), "File:A.jpg", own("small", 800)] },
      place,
      [photo("File:A.jpg")],
    );

    expect(result).toMatchObject({
      listing: {
        photos: [
          {
            title: "https://www.dolmama.am/assets/room.jpg",
            imageUrl: "https://www.dolmama.am/assets/room.jpg",
            pageUrl: "https://www.dolmama.am/",
            credit: "Dolmama’s website",
            freeLicense: false,
          },
          { title: "File:A.jpg", freeLicense: true },
        ],
        missing: ["https://www.dolmama.am/assets/small.jpg: only 800 pixels wide"],
      },
    });
  });

  test("its sample tables come with it, so it can be booked", () => {
    const result = listingFrom(
      { osm: place.osmRef, photos: [], tables: { INDOOR: [2, 4] } },
      place,
      [],
    );

    expect("listing" in result && result.listing.tables).toEqual([
      { label: "T1", capacity: 2, minCapacity: 1, zone: "INDOOR" },
      { label: "T2", capacity: 4, minCapacity: 2, zone: "INDOOR" },
    ]);
  });

  test(`at most ${MAX_PHOTOS} photos, the first ones named`, () => {
    const titles = ["A", "B", "C", "D", "E", "F"].map((letter) => `File:${letter}.jpg`);
    const result = listingFrom(
      { osm: place.osmRef, photos: titles },
      place,
      titles.map((title) => photo(title)),
    );

    expect("listing" in result && result.listing.photos.map(({ title }) => title)).toEqual(
      titles.slice(0, MAX_PHOTOS),
    );
  });

  test("what no source gives is kept and named, never guessed: hours, cuisine and unusable photos", () => {
    const result = listingFrom(
      { osm: place.osmRef, photos: ["File:Missing.jpg", "File:Closed.jpg", "File:Small.jpg"] },
      { ...place, openingHours: "sunrise-sunset", cuisine: "caucasian" },
      [
        photo("File:Closed.jpg", { license: "CC BY-NC 4.0" }),
        photo("File:Small.jpg", { width: 640 }),
      ],
    );

    expect(result).toMatchObject({
      listing: {
        openingHours: [],
        cuisines: [],
        photos: [],
        missing: [
          "opening hours (OpenStreetMap's \"sunrise-sunset\" isn't read)",
          'cuisine (OpenStreetMap says "caucasian")',
          "File:Missing.jpg: not on Commons",
          "File:Closed.jpg: license not accepted (CC BY-NC 4.0)",
          "File:Small.jpg: only 640 pixels wide",
          "photos",
        ],
      },
    });
    expect(
      listingFrom(
        { osm: place.osmRef, photos: [] },
        { ...place, openingHours: null, cuisine: null },
        [],
      ),
    ).toMatchObject({
      listing: { missing: ["opening hours", "cuisine", "photos"] },
    });
  });

  test("a house number from a building nearby gives way to one checked by hand, or is flagged to check", () => {
    const gata = {
      ...place,
      osmRef: "node/5570760261",
      nameEn: "Gata Pandok",
      street: "Tumanyan street",
      housenumber: "15",
      ownAddress: false,
    };
    const own = { value: "22 Tumanyan Street, Yerevan", sources: ["https://gatapandok.am/"] };

    expect(listingFrom({ osm: gata.osmRef, photos: [], address: own }, gata, [])).toMatchObject({
      listing: {
        address: "22 Tumanyan Street, Yerevan",
        detailSources: { address: ["https://gatapandok.am/"] },
        missing: ["photos"],
      },
    });
    const flagged = listingFrom({ osm: gata.osmRef, photos: [] }, gata, []);
    expect(flagged).toMatchObject({
      listing: {
        address: "15 Tumanyan Street, Yerevan",
        detailSources: { address: ["https://www.openstreetmap.org/node/5570760261"] },
      },
    });
    expect("listing" in flagged && flagged.listing.missing[0]).toBe(
      "its own house number: this one is from a building nearby, so check it",
    );
  });

  test("only a name, an address with a house number and a district are needed, all named at once", () => {
    const result = listingFrom(
      { osm: place.osmRef, photos: [] },
      { ...place, nameEn: null, housenumber: null, district: null },
      [],
    );

    expect(result).toEqual({
      problems: [
        "no English name",
        "no address with a house number",
        "not in a Yerevan district: none",
      ],
    });
  });

  test("no place at OpenStreetMap at all", () => {
    expect(listingFrom({ osm: "node/1", photos: [] }, null, [])).toEqual({
      problems: ["OpenStreetMap has no such place"],
    });
  });
});
