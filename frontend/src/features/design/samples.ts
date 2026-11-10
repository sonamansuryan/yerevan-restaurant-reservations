// Sample data for /design, shaped exactly like the API's answers. The six named ones are the demo
// restaurants, with their real hours, so /design and the real pages look alike.
import type { OpeningHours, RestaurantDetail, RestaurantSummary } from "@/types/api";

const restaurant = (
  fields: Pick<RestaurantSummary, "slug" | "name" | "cuisines" | "district" | "priceLevel"> &
    Partial<RestaurantSummary>,
): RestaurantSummary => ({
  description: null,
  address: "Yerevan",
  avgRating: 0,
  reviewCount: 0,
  coverPhotoUrl: null,
  ...fields,
});

const kondHouse = restaurant({
  slug: "kond-house",
  name: "Kond House",
  description: "Shared Middle Eastern plates for bigger groups, around a quiet courtyard.",
  cuisines: ["MIDDLE_EASTERN"],
  district: "KENTRON",
  priceLevel: 2,
});

const loriSmokehouse = restaurant({
  slug: "lori-smokehouse",
  name: "Lori Smokehouse",
  description: "Khorovats and slow-smoked meats, cooked over an open grill.",
  cuisines: ["ARMENIAN", "STEAKHOUSE"],
  district: "ARABKIR",
  address: "52 Komitas Avenue, Yerevan",
  priceLevel: 2,
});

const nurr = restaurant({
  slug: "nurr",
  name: "Nurr",
  description: "Modern Armenian plates built around the season, in a warm dining room.",
  cuisines: ["ARMENIAN", "FUSION"],
  district: "KENTRON",
  address: "14 Pushkin Street, Yerevan",
  priceLevel: 3,
});

const sevanAndSalt = restaurant({
  slug: "sevan-and-salt",
  name: "Sevan & Salt",
  description: "Trout and seafood from the lake and beyond, served simply.",
  cuisines: ["SEAFOOD"],
  district: "NOR_NORK",
  priceLevel: 3,
});

const tbilisiCourtyard = restaurant({
  slug: "tbilisi-courtyard",
  name: "Tbilisi Courtyard",
  description: "Khachapuri, khinkali and Georgian wine at everyday prices.",
  cuisines: ["GEORGIAN"],
  district: "MALATIA_SEBASTIA",
  priceLevel: 1,
});

const tsiranWineRoom = restaurant({
  slug: "tsiran-wine-room",
  name: "Tsiran Wine Room",
  description: "Armenian wines by the glass, with small plates until late at the weekend.",
  cuisines: ["ARMENIAN", "EUROPEAN"],
  district: "KENTRON",
  address: "31 Saryan Street, Yerevan",
  priceLevel: 2,
});

export const sampleRestaurants: RestaurantSummary[] = [
  kondHouse,
  loriSmokehouse,
  nurr,
  sevanAndSalt,
  tbilisiCourtyard,
  tsiranWineRoom,
];

/** A long Armenian name, which has to wrap well on the cover and under it. */
export const armenianName = restaurant({
  slug: "sardarapat-azgagrakan",
  name: "Սարդարապատ ազգագրական ճաշարան",
  description: "Recipes from the villages of Armavir, in a house with a long courtyard table.",
  cuisines: ["ARMENIAN"],
  district: "MALATIA_SEBASTIA",
  address: "12 Sebastia Street, Yerevan",
  priceLevel: 2,
});

/** Every cuisine line and price at its longest. */
export const manyCuisines = restaurant({
  slug: "the-cascade-tasting-room",
  name: "The Cascade Tasting Room",
  description:
    "A tasting menu that moves between Armenian, Georgian and Middle Eastern kitchens, with a wine for every course.",
  cuisines: ["ARMENIAN", "GEORGIAN", "MIDDLE_EASTERN"],
  district: "KANAKER_ZEYTUN",
  priceLevel: 4,
});

/** Some restaurants haven't written a description yet. */
export const noDescription = restaurant({
  slug: "dolma-corner",
  name: "Dolma Corner",
  cuisines: ["ARMENIAN"],
  district: "AVAN",
  priceLevel: 1,
});

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

/** Hours as the API sends them, ready-made times included. 1560 minutes is 02:00 the next day. */
function hours(days: number[], opensAt: number, closesAt: number): OpeningHours[] {
  const time = (minutes: number): string =>
    `${String(Math.floor((minutes % 1440) / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  return days.map((dayOfWeek) => ({
    dayOfWeek,
    opensAt,
    closesAt,
    opens: time(opensAt),
    closes: time(closesAt),
  }));
}

const page = (summary: RestaurantSummary, extra: Partial<RestaurantDetail>): RestaurantDetail => ({
  ...summary,
  phone: null,
  website: null,
  photos: [],
  openingHours: [],
  mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${summary.name}, ${summary.address}`)}`,
  ...extra,
});

/** Late on Friday and Saturday, and closed on Monday. */
export const tsiranPage = page(tsiranWineRoom, {
  phone: "+37400000102",
  openingHours: [...hours([0, 2, 3, 4], 1080, 1380), ...hours([5, 6], 1080, 1560)],
});

/** Lunch and dinner every day, closed in between, and no description yet. */
export const loriPage = page(
  { ...loriSmokehouse, description: null },
  {
    phone: "+37400000103",
    openingHours: [...hours(EVERY_DAY, 720, 900), ...hours(EVERY_DAY, 1080, 1380)],
  },
);

export const armenianPage = page(armenianName, {
  phone: "+37400000108",
  website: "https://www.example.com/sardarapat",
  openingHours: hours(EVERY_DAY, 660, 1320),
});

export const reviewedPage = page(nurr, {
  avgRating: 4.6,
  reviewCount: 23,
  phone: "+37400000101",
  openingHours: hours(EVERY_DAY, 720, 1380),
});
