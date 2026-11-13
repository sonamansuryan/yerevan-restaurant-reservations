// The rules for Seghan's demo listings (PROJECT_PLAN.md 9.7): real Yerevan restaurants that aren't
// on Seghan, listed from OpenStreetMap and details checked by hand against public listings, with
// photos from Wikimedia Commons or the restaurant's own site, and sample tables for trying
// Seghan's booking. These turn what those sources say into a listing, or say why a place can't be
// one. They're plain functions, so they're tested on their own (tests/demo-listings.rules.test.ts).
import { createHash } from "node:crypto";

import type { Cuisine, District, TableZone } from "../../src/generated/prisma/enums.ts";
import { MINUTES_PER_DAY } from "../../src/lib/time.ts";
import {
  extraOpenings,
  findOverlaps,
} from "../../src/modules/opening-hours/opening-hours.rules.ts";
import type { Opening } from "../../src/modules/opening-hours/opening-hours.rules.ts";
import type { CommonsPhoto } from "../../src/integrations/wikimedia/commons.ts";
import type { OsmPlace } from "../../src/integrations/geoapify/places.ts";

/** The account every demo listing belongs to. It has no password, so nobody can sign in as it. */
export const LISTINGS_OWNER = {
  email: "listings@example.com",
  name: "Seghan demo listings",
} as const;

/**
 * At most this many listings. The OpenStreetMap Foundation counts a one-off extract of fewer than
 * 100 places as insubstantial, so Seghan's own list never has to carry the database's license.
 */
export const MAX_LISTINGS = 99;

/** A cover and four more: the page shows them all, and there's little to copy. */
export const MAX_PHOTOS = 5;

/** Narrower photos look soft on a wide screen. */
export const MIN_PHOTO_WIDTH = 900;

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function minutesFrom(text: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (!match) return null;
  const [hours, minutes] = [Number(match[1]), Number(match[2])];
  return hours <= 24 && minutes < 60 && hours * 60 + minutes <= MINUTES_PER_DAY
    ? hours * 60 + minutes
    : null;
}

/** "Mo-Fr", "Sa,Su" or "PH,Mo-Su" as weekdays (0 = Sunday), or null if any part isn't a day. */
function daysFrom(text: string): number[] | null {
  const days = new Set<number>();
  for (const part of text.split(",")) {
    // Public holidays have no weekday of their own here, so they're left out.
    if (part === "PH") continue;
    const [first, last = first] = part.split("-");
    const from = DAYS.indexOf(first ?? "");
    const to = DAYS.indexOf(last ?? "");
    if (from === -1 || to === -1) return null;
    // Mo-Su runs through to Sunday, past the end of the list.
    for (let day = from; ; day = (day + 1) % 7) {
      days.add(day);
      if (day === to) break;
    }
  }
  return [...days];
}

/** "11:00-00:00" or "12:00-15:00,18:00-23:00" as openings, or null. "00:00" or "24:00" closes at midnight. */
function timesFrom(text: string): { opensAt: number; closesAt: number }[] | null {
  const times: { opensAt: number; closesAt: number }[] = [];
  for (const part of text.split(",")) {
    const [start = "", end = ""] = part.split("-");
    const opensAt = minutesFrom(start);
    let closesAt = minutesFrom(end);
    if (opensAt === null || closesAt === null || opensAt >= MINUTES_PER_DAY) return null;
    // Closing at or before opening means after midnight, as on a restaurant's own page.
    if (closesAt <= opensAt) closesAt += MINUTES_PER_DAY;
    if (closesAt - opensAt > MINUTES_PER_DAY) return null;
    times.push({ opensAt, closesAt });
  }
  return times;
}

/**
 * The week a place's OpenStreetMap `opening_hours` describes, or null when it uses more of that
 * format than this reads, such as months, weeks or sunrise. It reads "24/7", rules split by ";"
 * (or by "," before a day), days like "Mo-Fr" or "Sa,Su", times like "11:00-00:00" or split shifts,
 * and "off". A later rule replaces an earlier one for the days it names, as the format says.
 */
export function openingHoursFrom(text: string | null): Opening[] | null {
  if (!text?.trim()) return null;
  const tidy = text
    .trim()
    .replace(/[–—]/g, "-")
    .replace(/\s*-\s*/g, "-");
  if (tidy === "24/7") {
    return [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      dayOfWeek,
      opensAt: 0,
      closesAt: MINUTES_PER_DAY,
    }));
  }

  const week = new Map<number, { opensAt: number; closesAt: number }[]>();
  // A "," after a time or "off" and before a day starts a new rule; any other "," lists times, as
  // in "12:00-15:00,18:00-23:00", or days, as in "Sa,Su".
  const rules = tidy.split(/\s*;\s*|(?<=\d|off)\s*,\s*(?=(?:Mo|Tu|We|Th|Fr|Sa|Su|PH)\b)/);
  for (const rule of rules) {
    if (!rule) continue;
    const match = /^(?:([A-Za-z,-]+):?\s+)?(off|closed|[\d:,-]+)$/.exec(rule);
    if (!match) return null;
    const days = match[1] === undefined ? [0, 1, 2, 3, 4, 5, 6] : daysFrom(match[1]);
    if (!days) return null;
    const value = match[2] ?? "";
    const times = value === "off" || value === "closed" ? [] : timesFrom(value);
    if (!times) return null;
    for (const day of days) week.set(day, times);
  }

  const openings = [...week.entries()]
    .flatMap(([dayOfWeek, times]) => times.map((time) => ({ dayOfWeek, ...time })))
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.opensAt - b.opensAt);
  // The same checks as an owner's own week: nothing open twice at once, and three a day at most.
  if (openings.length === 0) return null;
  if (findOverlaps(openings).length > 0 || extraOpenings(openings).length > 0) return null;
  return openings;
}

// OpenStreetMap's `cuisine` values that match one of Seghan's. "regional" and "local" mean the
// cuisine of where the place is, which in Yerevan is Armenian. Anything else, such as "caucasian",
// "international" or "coffee_shop", has no match, rather than a guess.
const CUISINES: Record<string, Cuisine> = {
  armenian: "ARMENIAN",
  regional: "ARMENIAN",
  local: "ARMENIAN",
  georgian: "GEORGIAN",
  lebanese: "MIDDLE_EASTERN",
  arab: "MIDDLE_EASTERN",
  persian: "MIDDLE_EASTERN",
  syrian: "MIDDLE_EASTERN",
  turkish: "MIDDLE_EASTERN",
  middle_eastern: "MIDDLE_EASTERN",
  european: "EUROPEAN",
  french: "EUROPEAN",
  german: "EUROPEAN",
  greek: "EUROPEAN",
  spanish: "EUROPEAN",
  italian: "ITALIAN",
  pizza: "ITALIAN",
  asian: "ASIAN",
  chinese: "ASIAN",
  japanese: "ASIAN",
  korean: "ASIAN",
  thai: "ASIAN",
  vietnamese: "ASIAN",
  indian: "ASIAN",
  curry: "ASIAN",
  sushi: "ASIAN",
  fusion: "FUSION",
  seafood: "SEAFOOD",
  fish: "SEAFOOD",
  steak_house: "STEAKHOUSE",
  vegetarian: "VEGETARIAN",
  vegan: "VEGETARIAN",
};

/** Seghan's cuisines for OpenStreetMap's `cuisine`, such as "armenian;georgian", in its order. */
export function cuisinesFrom(text: string | null): Cuisine[] {
  const found = (text ?? "")
    .split(";")
    .map((value) => CUISINES[value.trim().toLowerCase()])
    .filter((cuisine): cuisine is Cuisine => cuisine !== undefined);
  return [...new Set(found)];
}

const DISTRICTS: Record<string, District> = {
  ajapnyak: "AJAPNYAK",
  arabkir: "ARABKIR",
  avan: "AVAN",
  davtashen: "DAVTASHEN",
  erebuni: "EREBUNI",
  kanakerzeytun: "KANAKER_ZEYTUN",
  kentron: "KENTRON",
  malatiasebastia: "MALATIA_SEBASTIA",
  nornork: "NOR_NORK",
  norkmarash: "NORK_MARASH",
  nubarashen: "NUBARASHEN",
  shengavit: "SHENGAVIT",
};

/** One of Yerevan's twelve districts, from a name such as "Kentron" or "Malatia-Sebastia". */
export function districtFrom(name: string | null): District | null {
  return DISTRICTS[(name ?? "").toLowerCase().replace(/[^a-z]/g, "")] ?? null;
}

/** "Tavern Yerevan" as "tavern-yerevan": for a page's address. */
export function slugFrom(text: string): string {
  return text
    .normalize("NFKD")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "10 Pushkin Street, Yerevan", as Seghan writes addresses. */
export function addressFrom(street: string, housenumber: string): string {
  // OpenStreetMap's English names sometimes say "street" or "avenue" in lowercase.
  const tidy = street.replace(/\b(street|avenue|lane|square)\b/g, (word) =>
    word.replace(/^./, (first) => first.toUpperCase()),
  );
  return `${housenumber} ${tidy}, Yerevan`;
}

// The licenses a listing's photos may have: free to reuse and store, with the credit Seghan shows.
// The CC licenses' 4.0 versions accept a credit that links to a page with the license, as
// Seghan's does. Older versions also ask for the photo's title and the license's own link.
const FREE_LICENSE = /^(CC0|Public domain|CC BY(-SA)? 4\.0)$/i;

/** Whether a photo's license lets Seghan show it, credited. */
export function isFreeLicense(license: string | null): boolean {
  return license !== null && FREE_LICENSE.test(license.trim());
}

/** The line that credits a photo, such as "Benoît Prieur, CC0". */
export function creditFrom({ author, license }: Pick<CommonsPhoto, "author" | "license">): string {
  return `${author?.trim() || "Unknown author"}, ${license ?? "license unknown"}`;
}

/**
 * Where a photo lives at Cloudinary: a fixed name from its listing and its file, so a second import
 * finds it already there instead of copying it again. A listing is known by its OpenStreetMap id,
 * or by its slug when it isn't there (`listingKey`).
 */
export function photoPublicId(key: string, title: string): string {
  const file = createHash("sha256").update(title).digest("hex").slice(0, 16);
  return `seghan/demo-listings/${key.replace("/", "-")}/${file}`;
}

/** The place at OpenStreetMap, where anyone can check a listing's details: "node/123" → its page. */
export function osmUrl(osmRef: string): string {
  return `https://www.openstreetmap.org/${osmRef}`;
}

/** A detail checked by hand, which comes ahead of OpenStreetMap's. */
export interface Checked<T> {
  value: T;
  /** The pages that say it, such as the restaurant's own site, Spyur or Visit Yerevan. */
  sources: string[];
}

/**
 * A photo from the restaurant's own site. Its license doesn't let anyone reuse it, so it's shown,
 * credited to that site, only while Seghan is a private demo: before Seghan is deployed, it's
 * replaced, or the restaurant's permission is asked (PROJECT_PLAN.md 9.7).
 */
export interface OwnPhoto {
  /** The file, for Cloudinary to fetch. */
  url: string;
  /** The page it's on, which the credit links to. */
  page: string;
  /** Whose it is, as the credit reads, such as "Dolmama’s website". */
  credit: string;
  /** Its width in pixels, as reviewed. */
  width: number;
}

/** A sample table, for trying Seghan's booking: made up, not the restaurant's own floor plan. */
export interface ListingTable {
  label: string;
  capacity: number;
  minCapacity: number;
  zone: TableZone;
}

// The seed's labels: T1, T2 … in the room and on the terrace, V for a private room, B at the bar.
const LABELS: Record<TableZone, string> = { INDOOR: "T", TERRACE: "T", VIP: "V", BAR_COUNTER: "B" };
const ZONES: TableZone[] = ["INDOOR", "TERRACE", "VIP", "BAR_COUNTER"];

/**
 * Sample tables from their seats in each zone, such as { INDOOR: [2, 4], TERRACE: [4] }, labelled
 * in that order. Each seats at least half its seats, so two guests never take a table for eight,
 * and one guest can have a table for two.
 */
export function tablesFrom(seats: Partial<Record<TableZone, number[]>>): ListingTable[] {
  const counts = new Map<string, number>();
  return ZONES.flatMap((zone) =>
    (seats[zone] ?? []).map((capacity) => {
      const prefix = LABELS[zone];
      const number = (counts.get(prefix) ?? 0) + 1;
      counts.set(prefix, number);
      const minCapacity = capacity <= 2 ? 1 : Math.ceil(capacity / 2);
      return { label: `${prefix}${number}`, capacity, minCapacity, zone };
    }),
  );
}

/** The details a listing's sources are named for, so a reviewer can check each one. */
export type DetailField =
  "name" | "address" | "district" | "cuisines" | "openingHours" | "phone" | "website";

/** One photo of a listing, as the import copies and credits it. */
export interface ListingPhoto {
  /** Its file name at Commons, such as "File:Dolmama.jpg", or a restaurant's own photo's address. */
  title: string;
  /** For Cloudinary to fetch: a Commons copy at most 1920 pixels wide, or the restaurant's file. */
  imageUrl: string;
  /** The page the credit links to: the file's page at Commons, or the restaurant's own page. */
  pageUrl: string;
  credit: string;
  /** Whether its license lets anyone reuse it. A restaurant's own photo's doesn't. */
  freeLicense: boolean;
}

/** A demo listing, as listings.json holds it and the import writes it. */
export interface Listing {
  /** Its OpenStreetMap id, or null for a place that isn't there. */
  osmRef: string | null;
  slug: string;
  name: string;
  cuisines: Cuisine[];
  district: District;
  address: string;
  phone: string | null;
  website: string | null;
  /** A sentence or two in Seghan's own words, from the checked facts. */
  description: string | null;
  openingHours: Opening[];
  /** The hours as their source writes them, kept so a reviewer can compare. */
  openingHoursText: string;
  /** When someone last checked the place in OpenStreetMap, if they said. */
  checkDate: string | null;
  photos: ListingPhoto[];
  /** Sample tables, so it can be booked to try Seghan out. */
  tables: ListingTable[];
  /** Where each detail comes from: the place at OpenStreetMap, or the pages checked by hand. */
  detailSources: Partial<Record<DetailField, string[]>>;
  /** What no source gives, for the reviewer: such as "opening hours", "cuisine" or "photos". */
  missing: string[];
}

/** One place to list, as sources.ts names it. */
export interface ListingSource {
  /** Its OpenStreetMap id, such as "node/6566646015", when it's there. */
  osm?: string;
  /** Its page's address, when its name alone would clash with another's. */
  slug?: string;
  /** Its photos, cover first: Commons file names, or photos from the restaurant's own site. */
  photos: (string | OwnPhoto)[];
  // Details checked by hand, each with the pages that say it. They come ahead of OpenStreetMap's,
  // and a place that isn't there needs at least a name, an address and a district.
  name?: Checked<string>;
  address?: Checked<string>;
  district?: Checked<District>;
  cuisines?: Checked<Cuisine[]>;
  /** As OpenStreetMap writes them, such as "Mo-Su 11:00-23:30". */
  openingHours?: Checked<string>;
  phone?: Checked<string>;
  website?: Checked<string>;
  /** A sentence or two in Seghan's own words, from the checked facts. */
  description?: string;
  /** Sample tables' seats in each zone, for trying Seghan's booking, such as { INDOOR: [2, 4] }. */
  tables?: Partial<Record<TableZone, number[]>>;
}

/** What a listing is known by: its OpenStreetMap id, or its slug for a place that isn't there. */
export function listingKey({ osmRef, slug }: Pick<Listing, "osmRef" | "slug">): string {
  return osmRef ?? slug;
}

/** What a source is known by before it's a listing, for the reviewer. */
export function sourceKey(source: ListingSource): string {
  return source.osm ?? source.slug ?? slugFrom(source.name?.value ?? "");
}

/**
 * A listing from what the sources say about one place, or why it can't be one. It needs a name,
 * an address with a house number and a Yerevan district, each checked by hand or from
 * OpenStreetMap. Anything else it lacks is kept, and named in `missing`: its page then says the
 * opening hours aren't listed, shows no cuisine, or has a color block where a photo would be. A
 * photo whose license isn't free, or that's too narrow, is left out the same way.
 */
export function listingFrom(
  source: ListingSource,
  place: OsmPlace | null,
  photos: CommonsPhoto[],
): { listing: Listing } | { problems: string[] } {
  if (source.osm && !place) return { problems: ["OpenStreetMap has no such place"] };

  const osm = place ? osmUrl(place.osmRef) : null;
  const detailSources: Listing["detailSources"] = {};
  // A detail checked by hand comes first, then OpenStreetMap's, and each names its sources.
  function pick<T>(
    field: DetailField,
    checked: Checked<T> | undefined,
    fromOsm: T | null,
  ): T | null {
    if (checked) {
      detailSources[field] = checked.sources;
      return checked.value;
    }
    if (fromOsm === null || osm === null) return null;
    detailSources[field] = [osm];
    return fromOsm;
  }

  const problems: string[] = [];
  const name = pick("name", source.name, place?.nameEn?.trim() || null);
  if (!name) problems.push("no English name");
  // After an address checked by hand comes the place's own address in OpenStreetMap, and only
  // then a house number Geoapify took from a building nearby, which the reviewer is asked to check.
  const osmAddress =
    place?.street && place.housenumber ? addressFrom(place.street, place.housenumber) : null;
  let address = pick("address", source.address, place?.ownAddress ? osmAddress : null);
  const fromNearby = address === null && osmAddress !== null && osm !== null;
  if (fromNearby) {
    address = osmAddress;
    detailSources.address = [osm];
  }
  if (!address) problems.push("no address with a house number");
  const district = pick("district", source.district, districtFrom(place?.district ?? null));
  if (!district) problems.push(`not in a Yerevan district: ${place?.district ?? "none"}`);
  // Hours checked by hand that don't read are a mistake in sources.ts, not a gap.
  const checkedHours = source.openingHours ? openingHoursFrom(source.openingHours.value) : null;
  if (source.openingHours && !checkedHours) {
    problems.push(`opening hours "${source.openingHours.value}" don't read`);
  }
  if (!name || !address || !district || problems.length > 0) return { problems };

  const missing: string[] = [];
  if (fromNearby) {
    missing.push("its own house number: this one is from a building nearby, so check it");
  }
  const openingHours = pick(
    "openingHours",
    source.openingHours && checkedHours
      ? { value: checkedHours, sources: source.openingHours.sources }
      : undefined,
    openingHoursFrom(place?.openingHours ?? null),
  );
  if (!openingHours) {
    missing.push(
      place?.openingHours
        ? `opening hours (OpenStreetMap's "${place.openingHours}" isn't read)`
        : "opening hours",
    );
  }
  const osmCuisines = cuisinesFrom(place?.cuisine ?? null);
  const cuisines =
    pick("cuisines", source.cuisines, osmCuisines.length > 0 ? osmCuisines : null) ?? [];
  if (cuisines.length === 0) {
    missing.push(place?.cuisine ? `cuisine (OpenStreetMap says "${place.cuisine}")` : "cuisine");
  }
  const phone = pick("phone", source.phone, place?.phone ?? null);
  const website = pick("website", source.website, place?.website ?? null);

  const usable: ListingPhoto[] = [];
  for (const wanted of source.photos.slice(0, MAX_PHOTOS)) {
    if (typeof wanted !== "string") {
      if (wanted.width < MIN_PHOTO_WIDTH) {
        missing.push(`${wanted.url}: only ${wanted.width} pixels wide`);
      } else {
        usable.push({
          title: wanted.url,
          imageUrl: wanted.url,
          pageUrl: wanted.page,
          credit: wanted.credit,
          freeLicense: false,
        });
      }
      continue;
    }
    const photo = photos.find((one) => one.title === wanted);
    if (!photo) missing.push(`${wanted}: not on Commons`);
    else if (!isFreeLicense(photo.license)) {
      missing.push(`${wanted}: license not accepted (${photo.license ?? "none"})`);
    } else if (photo.width < MIN_PHOTO_WIDTH) {
      missing.push(`${wanted}: only ${photo.width} pixels wide`);
    } else {
      usable.push({
        title: wanted,
        imageUrl: photo.imageUrl,
        pageUrl: photo.pageUrl,
        credit: creditFrom(photo),
        freeLicense: true,
      });
    }
  }
  if (usable.length === 0) missing.push("photos");

  return {
    listing: {
      osmRef: place?.osmRef ?? null,
      slug: source.slug ?? slugFrom(name),
      name,
      cuisines,
      district,
      address,
      phone,
      website,
      description: source.description?.trim() || null,
      openingHours: openingHours ?? [],
      openingHoursText: source.openingHours?.value ?? place?.openingHours ?? "",
      checkDate: place?.checkDate ?? null,
      photos: usable,
      tables: tablesFrom(source.tables ?? {}),
      detailSources,
      missing,
    },
  };
}
