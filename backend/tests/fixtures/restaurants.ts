// Restaurants as the database hands them over, and as the API returns them.
import { ani } from "./users.ts";
import type {
  RestaurantDetail,
  RestaurantList,
  RestaurantSummary,
} from "../../src/modules/restaurants/restaurants.service.ts";

/** A Restaurant row with the fields the service selects. */
export interface RestaurantRow {
  slug: string;
  name: string;
  description: string | null;
  cuisines: string[] | null;
  district: string;
  address: string;
  priceLevel: number;
  avgRating: number;
  reviewCount: number;
  photos: { url: string; isCover?: boolean }[];
  phone?: string | null;
  website?: string | null;
  googlePlaceId?: string | null;
  openingHours?: { dayOfWeek: number; opensAt: number; closesAt: number }[];
}

/** A row with what the list selects, before it's turned into a summary. */
export function summaryRow(extra: Partial<RestaurantRow> = {}): RestaurantRow {
  return {
    slug: "tsiran-wine-room",
    name: "Tsiran Wine Room",
    description: "Armenian wines by the glass, with small plates until late at the weekend.",
    cuisines: ["ARMENIAN", "EUROPEAN"],
    district: "KENTRON",
    address: "31 Saryan Street, Yerevan",
    priceLevel: 2,
    avgRating: 0,
    reviewCount: 0,
    photos: [],
    ...extra,
  };
}

/** A row with what a restaurant's page selects: late on Friday and Saturday, closed on Monday. */
export function detailRow(extra: Partial<RestaurantRow> = {}): RestaurantRow {
  return {
    ...summaryRow(),
    phone: "+37400000102",
    website: null,
    googlePlaceId: null,
    openingHours: [
      { dayOfWeek: 0, opensAt: 1080, closesAt: 1380 },
      { dayOfWeek: 2, opensAt: 1080, closesAt: 1380 },
      { dayOfWeek: 5, opensAt: 1080, closesAt: 1560 },
      { dayOfWeek: 6, opensAt: 1080, closesAt: 1560 },
    ],
    ...extra,
  };
}

const tsiran: RestaurantSummary = {
  slug: "tsiran-wine-room",
  name: "Tsiran Wine Room",
  description: "Armenian wines by the glass.",
  cuisines: ["ARMENIAN", "EUROPEAN"],
  district: "KENTRON",
  address: "31 Saryan Street, Yerevan",
  priceLevel: 2,
  avgRating: 0,
  reviewCount: 0,
  coverPhotoUrl: null,
};

/** What GET /api/restaurants returns, for tests that replace the service. */
export const listReply: RestaurantList = {
  data: [tsiran],
  meta: { page: 1, pageSize: 12, total: 1 },
};

/** What GET /api/restaurants/:slug returns, for tests that replace the service. */
export const detailReply: RestaurantDetail = {
  ...tsiran,
  phone: "+37400000102",
  website: null,
  photos: [],
  openingHours: [{ dayOfWeek: 5, opensAt: 1080, closesAt: 1560, opens: "18:00", closes: "02:00" }],
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=Tsiran+Wine+Room%2C+31+Saryan+Street%2C+Yerevan",
};

/** A whole Restaurant row with its owner, as owner queries find it. */
export interface OwnedRow {
  id: string;
  ownerId: string;
  slug: string;
  name: string;
  description: string | null;
  cuisines: string[];
  district: string;
  address: string;
  phone: string | null;
  website: string | null;
  priceLevel: number;
  slotIntervalMin: number;
  reservationDurationMin: number;
  isPublished: boolean;
  googlePlaceId: string | null;
  avgRating: number;
  reviewCount: number;
}

/** One of Ani's restaurants, unless `extra` says otherwise. */
export function ownedRow(extra: Partial<OwnedRow> = {}): OwnedRow {
  return {
    id: "c3f6e5a4-7d8b-4c9f-a01a-2b3c4d5e6f70",
    ownerId: ani.id,
    slug: "tsiran-wine-room",
    name: "Tsiran Wine Room",
    description: "Armenian wines by the glass.",
    cuisines: ["ARMENIAN", "EUROPEAN"],
    district: "KENTRON",
    address: "31 Saryan Street, Yerevan",
    phone: "+37400000102",
    website: null,
    priceLevel: 2,
    slotIntervalMin: 30,
    reservationDurationMin: 120,
    isPublished: true,
    // Set, so a reply that leaked it would show it.
    googlePlaceId: "ChIJ-tsiran-wine-room",
    avgRating: 4.5,
    reviewCount: 12,
    ...extra,
  };
}
