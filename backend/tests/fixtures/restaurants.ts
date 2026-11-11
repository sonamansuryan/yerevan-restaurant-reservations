// Restaurants as the database hands them over, and as the API returns them.
import { ani } from "./users.ts";
import type {
  RestaurantDetail,
  RestaurantList,
  RestaurantSummary,
} from "../../src/modules/restaurants/restaurants.service.ts";
import type { SlotSettings } from "../../src/modules/availability/availability.rules.ts";
import type { Opening } from "../../src/modules/opening-hours/opening-hours.rules.ts";

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

// Demo restaurants as the start-time rules read them, with their hours as seeded. Times are
// minutes after the service day's midnight: 1080 is 18:00, and 1560 is 02:00 the next morning.

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

/** The same opening on several days (0 = Sunday … 6 = Saturday). */
function sameHours(days: readonly number[], opensAt: number, closesAt: number): Opening[] {
  return days.map((dayOfWeek) => ({ dayOfWeek, opensAt, closesAt }));
}

/** Lori Smokehouse: lunch 12:00–15:00 and dinner 18:00–23:00 every day, 2-hour bookings every 30 minutes. */
export function loriSlotSettings(extra: Partial<SlotSettings> = {}): SlotSettings {
  return {
    timezone: "Asia/Yerevan",
    slotIntervalMin: 30,
    reservationDurationMin: 120,
    openingHours: [...sameHours(EVERY_DAY, 720, 900), ...sameHours(EVERY_DAY, 1080, 1380)],
    ...extra,
  };
}

/** Tsiran Wine Room: 18:00–23:00, until 02:00 on Friday and Saturday, and closed on Monday. 90-minute bookings every 30 minutes. */
export function tsiranSlotSettings(extra: Partial<SlotSettings> = {}): SlotSettings {
  return {
    timezone: "Asia/Yerevan",
    slotIntervalMin: 30,
    reservationDurationMin: 90,
    openingHours: [...sameHours([0, 2, 3, 4], 1080, 1380), ...sameHours([5, 6], 1080, 1560)],
    ...extra,
  };
}

/** Sevan and Salt: 13:00–22:00 every day, 90-minute bookings every 15 minutes. */
export function sevanSlotSettings(extra: Partial<SlotSettings> = {}): SlotSettings {
  return {
    timezone: "Asia/Yerevan",
    slotIntervalMin: 15,
    reservationDurationMin: 90,
    openingHours: sameHours(EVERY_DAY, 780, 1320),
    ...extra,
  };
}
