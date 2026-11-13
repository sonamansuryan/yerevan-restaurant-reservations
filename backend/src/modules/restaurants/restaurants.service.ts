import { Prisma } from "../../generated/prisma/client.ts";
import type { Cuisine, District } from "../../generated/prisma/enums.ts";
import { NotFoundError } from "../../lib/errors.ts";
import { mapsEnabled } from "../../integrations/geoapify/maps.ts";
import { prisma } from "../../lib/prisma.ts";
import { minutesToTime } from "../../lib/time.ts";
import { FEATURED_COUNT, FEATURED_SLUGS, featuredOrder } from "./restaurants.rules.ts";
import type { RestaurantListQuery } from "./restaurants.schemas.ts";

/** A restaurant as Browse lists it. Only these fields ever leave the server. */
export interface RestaurantSummary {
  slug: string;
  name: string;
  description: string | null;
  cuisines: Cuisine[];
  district: District;
  address: string;
  /** 1 to 4, shown as ֏ to ֏֏֏֏, or null for a demo listing, whose price no source gives. */
  priceLevel: number | null;
  avgRating: number;
  reviewCount: number;
  /** The cover photo, or the first photo, or null when there's none. */
  coverPhotoUrl: string | null;
  /** A real restaurant listed from public data for the demo (9.7): it isn't on Seghan, so it can't be booked. */
  isDemoListing: boolean;
}

export interface OpeningHours {
  /** 0 = Sunday … 6 = Saturday. */
  dayOfWeek: number;
  /** Minutes after the day's midnight. A closing time past midnight is above 1440. */
  opensAt: number;
  closesAt: number;
  /** The same two times, ready to show, such as "18:00" and "02:00". */
  opens: string;
  closes: string;
}

/** A restaurant's own page. */
export interface RestaurantDetail extends RestaurantSummary {
  phone: string | null;
  website: string | null;
  /** A photo from Wikimedia Commons names its author and license, and links to its page there. */
  photos: { url: string; isCover: boolean; credit: string | null; creditUrl: string | null }[];
  openingHours: OpeningHours[];
  /** Where a demo listing's details come from, its place at OpenStreetMap, or null for any other. */
  osmUrl: string | null;
  /** Opens the restaurant in Google Maps. It needs no API key. */
  mapsUrl: string;
  /** The picture of its street, from our own API, or null when maps aren't set up (9.4). */
  mapImageUrl: string | null;
}

export interface RestaurantList {
  data: RestaurantSummary[];
  meta: { page: number; pageSize: number; total: number };
}

// Customers only ever see restaurants their owner published and Seghan hasn't hidden (9.5). Every
// public query starts from this, favorites, maps, availability and reviews included, so a new one
// can't forget it.
export const PUBLISHED = {
  isPublished: true,
  hiddenAt: null,
} satisfies Prisma.RestaurantWhereInput;

const PHOTO_ORDER = [
  { isCover: "desc" },
  { sortOrder: "asc" },
] satisfies Prisma.RestaurantPhotoOrderByWithRelationInput[];

/** What a restaurant's card needs, for Browse and My favorites alike. */
export const summaryFields = {
  slug: true,
  name: true,
  description: true,
  cuisines: true,
  district: true,
  address: true,
  priceLevel: true,
  avgRating: true,
  reviewCount: true,
  isDemoListing: true,
  photos: { orderBy: PHOTO_ORDER, take: 1, select: { url: true } },
} satisfies Prisma.RestaurantSelect;

const detailFields = {
  ...summaryFields,
  phone: true,
  website: true,
  googlePlaceId: true,
  osmRef: true,
  photos: {
    orderBy: PHOTO_ORDER,
    select: { url: true, isCover: true, credit: true, creditUrl: true },
  },
  openingHours: {
    orderBy: [{ dayOfWeek: "asc" }, { opensAt: "asc" }],
    select: { dayOfWeek: true, opensAt: true, closesAt: true },
  },
} satisfies Prisma.RestaurantSelect;

type SummaryRow = Prisma.RestaurantGetPayload<{ select: typeof summaryFields }>;
type DetailRow = Prisma.RestaurantGetPayload<{ select: typeof detailFields }>;

/**
 * The search and filters as a database condition. A search looks for the words, ignoring capitals,
 * in the name, the description and the address, so "khachapuri" finds a Georgian place.
 */
export function restaurantFilter({
  q,
  cuisine,
  district,
  price,
}: Pick<RestaurantListQuery, "q" | "cuisine" | "district" | "price">): Prisma.RestaurantWhereInput {
  return {
    ...PUBLISHED,
    ...(cuisine ? { cuisines: { has: cuisine } } : {}),
    ...(district ? { district } : {}),
    ...(price ? { priceLevel: price } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { address: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

/**
 * One page of published restaurants, and how many match in all: by name, or with the best rated
 * first. A rating with more reviews behind it comes before an equal one with fewer.
 */
export async function listRestaurants({
  page,
  pageSize,
  sort,
  ...filters
}: RestaurantListQuery): Promise<RestaurantList> {
  const where = restaurantFilter(filters);

  // Both reads in one transaction at REPEATABLE READ, so the page and the total come from the same
  // moment. At Postgres's default level, the second could see a restaurant published in between.
  const [rows, total] = await prisma.$transaction(
    [
      prisma.restaurant.findMany({
        where,
        select: summaryFields,
        // The id breaks the last ties, so no restaurant shows on two pages.
        orderBy: [
          ...(sort === "rating"
            ? [{ avgRating: "desc" as const }, { reviewCount: "desc" as const }]
            : []),
          { name: "asc" },
          { id: "asc" },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.restaurant.count({ where }),
    ],
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );

  return { data: rows.map(toSummary), meta: { page, pageSize, total } };
}

/**
 * The home page's few restaurants: the ones chosen by hand, in their order, filled up with the first
 * others by name, and how many restaurants there are in all, for "See all 16 restaurants". All three
 * reads are from one moment, as the list's are.
 */
export async function listFeatured(): Promise<RestaurantList> {
  const [chosen, byName, total] = await prisma.$transaction(
    [
      prisma.restaurant.findMany({
        where: { ...PUBLISHED, slug: { in: [...FEATURED_SLUGS] } },
        select: summaryFields,
      }),
      prisma.restaurant.findMany({
        where: { ...PUBLISHED, slug: { notIn: [...FEATURED_SLUGS] } },
        select: summaryFields,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: FEATURED_COUNT,
      }),
      prisma.restaurant.count({ where: PUBLISHED }),
    ],
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
  const data = featuredOrder(chosen, byName).map(toSummary);
  return { data, meta: { page: 1, pageSize: FEATURED_COUNT, total } };
}

/** A published restaurant's page. One that isn't published answers exactly like a missing one. */
export async function getRestaurant(slug: string): Promise<RestaurantDetail> {
  const row = await prisma.restaurant.findUnique({
    where: { slug, ...PUBLISHED },
    select: detailFields,
  });
  if (!row) throw new NotFoundError("RESTAURANT_NOT_FOUND");
  return toDetail(row);
}

export function toSummary(row: SummaryRow): RestaurantSummary {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    // The column allows null, which reads as "no cuisines".
    cuisines: row.cuisines ?? [],
    district: row.district,
    address: row.address,
    priceLevel: row.priceLevel,
    avgRating: row.avgRating,
    reviewCount: row.reviewCount,
    coverPhotoUrl: row.photos[0]?.url ?? null,
    isDemoListing: row.isDemoListing,
  };
}

function toDetail(row: DetailRow): RestaurantDetail {
  return {
    ...toSummary(row),
    phone: row.phone,
    website: row.website,
    photos: row.photos.map(({ url, isCover, credit, creditUrl }) => ({
      url,
      isCover,
      credit,
      creditUrl,
    })),
    openingHours: row.openingHours.map(({ dayOfWeek, opensAt, closesAt }) => ({
      dayOfWeek,
      opensAt,
      closesAt,
      opens: minutesToTime(opensAt),
      closes: minutesToTime(closesAt),
    })),
    // Only a demo listing has one, and anyone can check its details there.
    osmUrl: row.isDemoListing && row.osmRef ? `https://www.openstreetmap.org/${row.osmRef}` : null,
    mapsUrl: googleMapsUrl(row),
    mapImageUrl: mapsEnabled() ? `/api/restaurants/${row.slug}/map` : null,
  };
}

/**
 * Google Maps' documented search link, which needs no API key and opens the app on phones. With a
 * place id Google shows that exact place, and the name and address are its fallback.
 */
export function googleMapsUrl({
  name,
  address,
  googlePlaceId,
}: {
  name: string;
  address: string;
  googlePlaceId: string | null;
}): string {
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", `${name}, ${address}`);
  if (googlePlaceId) url.searchParams.set("query_place_id", googlePlaceId);
  return url.toString();
}
