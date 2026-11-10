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
 * One of the signed-in owner's restaurants, published or not. GET /api/owner/restaurants answers a
 * ListResponse of them, by name. One restaurant comes inside { restaurant }:
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

/**
 * GET /api/owner/restaurants/:restaurantId/opening-hours: the week as saved. PUT to the same address
 * answers the same way, with the week that replaced the old one, in order from Sunday (0) and by
 * opening time. A day with no opening is closed. A week that
 * breaks a rule, such as two openings that overlap, answers 400 with a message on each opening:
 * `details.fields["hours.1"]` is "Overlaps Monday 12:00–15:00." for the second one sent.
 */
export interface OpeningHoursResponse {
  openingHours: OpeningHours[];
}

/** One photo of one of the owner's restaurants. Its address is ready for photoUrl(). */
export interface OwnerPhoto {
  id: string;
  url: string;
  /** Exactly one photo is the cover, shown first on the restaurant's page and card. */
  isCover: boolean;
  sortOrder: number;
}

/**
 * The restaurant's photos, the cover first, then in the order they were added:
 * - GET /api/owner/restaurants/:restaurantId/photos, as saved
 * - POST /api/owner/restaurants/:restaurantId/photos (201), saving an upload
 * - PATCH /api/owner/restaurants/:restaurantId/photos/:photoId, choosing the cover
 * - DELETE /api/owner/restaurants/:restaurantId/photos/:photoId
 */
export interface OwnerPhotosResponse {
  photos: OwnerPhoto[];
}

/**
 * POST /api/owner/restaurants/:restaurantId/photos/signature: permission for one upload straight
 * from the browser to Cloudinary, valid for an hour. Send `fields` and the file (as "file") in a
 * multipart form to `url`. Then POST Cloudinary's public_id, version and signature to /photos as
 * publicId, version and signature. A restaurant with 10 photos answers 409 TOO_MANY_PHOTOS.
 */
export interface PhotoUploadResponse {
  upload: { url: string; fields: Record<string, string> };
}

/** What a restaurant still needs before guests can see it. */
export type PublishBlocker = "TABLE" | "OPENING_HOURS";

/** PENDING, CONFIRMED and ARRIVED hold the table. CANCELLED and NO_SHOW free it. */
export type ReservationStatus = "PENDING" | "CONFIRMED" | "ARRIVED" | "NO_SHOW" | "CANCELLED";
export type TableZone = "INDOOR" | "TERRACE" | "VIP" | "BAR_COUNTER";

/**
 * One booking in a restaurant's book for the day. GET
 * /api/owner/restaurants/:restaurantId/reservations?date=YYYY-MM-DD answers a ListResponse of
 * these: every status, by time and then table. A booking belongs to the date it starts on, on the
 * restaurant's clock.
 */
export interface OwnerReservation {
  id: string;
  status: ReservationStatus;
  partySize: number;
  /** The exact moments, in UTC. */
  startsAt: string;
  endsAt: string;
  /** The same two moments on the restaurant's clock, ready to show, such as "19:00" and "01:30". */
  starts: string;
  ends: string;
  table: { id: string; label: string; zone: TableZone };
  /** The guest's name only. */
  guest: { name: string };
  specialRequests: string | null;
  /** Who cancelled, and why, for a cancelled booking. Otherwise null. */
  cancellation: { by: "CUSTOMER" | "RESTAURANT" | null; reason: string | null } | null;
}

/**
 * The `details` of 409 NOT_READY_TO_PUBLISH, when a PATCH tries to publish too early. The message
 * already says what to add, such as "Add your opening hours before you publish."
 */
export interface NotReadyToPublishDetails {
  missing: PublishBlocker[];
}
