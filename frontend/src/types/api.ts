/** A user, as the auth endpoints return them. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: "CUSTOMER" | "OWNER" | "ADMIN";
}

/** POST /api/auth/register, /login, /google and /refresh, and GET /api/me */
export interface AuthResponse {
  user: AuthUser;
}

/** The body of every error response. */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** A page of a list: GET /api/restaurants and later lists. */
export interface ListResponse<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number };
}

export type Cuisine =
  | "ARMENIAN"
  | "GEORGIAN"
  | "MIDDLE_EASTERN"
  | "EUROPEAN"
  | "ITALIAN"
  | "ASIAN"
  | "FUSION"
  | "SEAFOOD"
  | "STEAKHOUSE"
  | "VEGETARIAN";

export type District =
  | "AJAPNYAK"
  | "ARABKIR"
  | "AVAN"
  | "DAVTASHEN"
  | "EREBUNI"
  | "KANAKER_ZEYTUN"
  | "KENTRON"
  | "MALATIA_SEBASTIA"
  | "NOR_NORK"
  | "NORK_MARASH"
  | "NUBARASHEN"
  | "SHENGAVIT";

/** A restaurant as GET /api/restaurants lists it. */
export interface RestaurantSummary {
  slug: string;
  name: string;
  description: string | null;
  cuisines: Cuisine[];
  district: District;
  address: string;
  /** 1 to 4, shown as ֏ to ֏֏֏֏. */
  priceLevel: number;
  avgRating: number;
  reviewCount: number;
  /** The cover photo's Cloudinary address, or null when there's no photo. */
  coverPhotoUrl: string | null;
}

export interface OpeningHours {
  /** 0 = Sunday … 6 = Saturday. */
  dayOfWeek: number;
  /** Minutes after the day's midnight. A closing time past midnight is above 1440. */
  opensAt: number;
  closesAt: number;
  /** Ready to show, such as "18:00" and "02:00". */
  opens: string;
  closes: string;
}

/** GET /api/restaurants/:slug, inside { restaurant }. */
export interface RestaurantDetail extends RestaurantSummary {
  phone: string | null;
  website: string | null;
  photos: { url: string; isCover: boolean }[];
  openingHours: OpeningHours[];
  mapsUrl: string;
}

export interface RestaurantResponse {
  restaurant: RestaurantDetail;
}

/**
 * One of the signed-in owner's restaurants, published or not, inside { restaurant }:
 * - GET /api/owner/restaurants/:restaurantId
 * - POST /api/owner/restaurants (201), which always creates it unpublished
 * - PATCH /api/owner/restaurants/:restaurantId
 *
 * Anyone else's restaurant answers 404 RESTAURANT_NOT_FOUND.
 */
export interface OwnerRestaurant {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  cuisines: Cuisine[];
  district: District;
  address: string;
  phone: string | null;
  website: string | null;
  priceLevel: number;
  /** Minutes between the start times guests can choose. */
  slotIntervalMin: number;
  /** How long one booking holds its table, in minutes. */
  reservationDurationMin: number;
  isPublished: boolean;
}

export interface OwnerRestaurantResponse {
  restaurant: OwnerRestaurant;
}

/** What a restaurant still needs before guests can see it. */
export type PublishBlocker = "TABLE" | "OPENING_HOURS";

/**
 * The `details` of 409 NOT_READY_TO_PUBLISH, when a PATCH tries to publish too early. The message
 * already says what to add, such as "Add your opening hours before you publish."
 */
export interface NotReadyToPublishDetails {
  missing: PublishBlocker[];
}
