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

/**
 * A page of a list: GET /api/restaurants and later lists. GET /api/restaurants/featured answers the
 * same way, with the home page's few: those chosen by hand, then the first others by name, and the
 * total of every published restaurant.
 */
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

/**
 * How GET /api/restaurants orders its list: by name (the default), or by rating, the best rated
 * first, more reviews before fewer at the same rating, and those without reviews last.
 */
export type RestaurantSort = "name" | "rating";

/** A restaurant as GET /api/restaurants lists it. */
export interface RestaurantSummary {
  slug: string;
  name: string;
  description: string | null;
  cuisines: Cuisine[];
  district: District;
  address: string;
  /** 1 to 4, shown as ֏ to ֏֏֏֏, or null for a demo listing, whose price no source gives. */
  priceLevel: number | null;
  /** The average of its reviews, from 1 to 5, or 0 when it has none. */
  avgRating: number;
  reviewCount: number;
  /** The cover photo's Cloudinary address, or null when there's no photo. */
  coverPhotoUrl: string | null;
  /**
   * A real Yerevan restaurant listed from public data for the demo (9.7). It isn't on Seghan, so
   * it can't be booked: it has no tables.
   */
  isDemoListing: boolean;
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
  /** A photo from Wikimedia Commons credits its author and license, linking to its page there. */
  photos: { url: string; isCover: boolean; credit: string | null; creditUrl: string | null }[];
  openingHours: OpeningHours[];
  /** A demo listing's place at OpenStreetMap, where its details come from. Null for any other. */
  osmUrl: string | null;
  mapsUrl: string;
  /**
   * The picture of its street, from GET /api/restaurants/:slug/map (OpenStreetMap, drawn by
   * Geoapify), or null when maps aren't set up. That address answers 404 for an address that can't
   * be found, and 503 when Geoapify fails: then there's simply no map.
   */
  mapImageUrl: string | null;
}

export interface RestaurantResponse {
  restaurant: RestaurantDetail;
}

/** A table a guest can book at one start time. */
export interface AvailableTable {
  id: string;
  label: string;
  zone: TableZone;
  /** The most guests it takes. */
  capacity: number;
}

/** A time a booking can start, with the tables free for the whole booking. */
export interface AvailabilitySlot {
  /** Exact moments, in UTC. */
  startsAt: string;
  endsAt: string;
  /** On the restaurant's clock, ready to show, such as "23:30" and "01:00". */
  starts: string;
  ends: string;
  /** Empty when every table that fits the party is taken then. */
  tables: AvailableTable[];
}

/**
 * GET /api/restaurants/:slug/availability?date=YYYY-MM-DD&partySize=N, for anyone. A restaurant
 * that isn't published answers 404 RESTAURANT_NOT_FOUND. A date with no times, such as a closed
 * day or one outside bookingWindow, has no slots.
 */
export interface Availability {
  date: string;
  partySize: number;
  /** The first and last dates guests can book: today and 60 days later, as YYYY-MM-DD. */
  bookingWindow: { first: string; last: string };
  slots: AvailabilitySlot[];
}

/**
 * A booking as the guest who made it sees it. Only signed-in guests reach these:
 * - POST /api/reservations answers 201 with it inside { reservation }, for { tableId, date, time,
 *   partySize, specialRequests? } with a time and table the availability offered. It's PENDING
 *   until the restaurant confirms it. Refusals: 409 SLOT_TAKEN (fetch the availability again), 409
 *   TABLE_BLOCKED, 404 TABLE_NOT_FOUND, and 400 with fields.time or fields.partySize.
 * - GET /api/reservations?when=upcoming|past&page=&pageSize= answers a ListResponse of the guest's
 *   own bookings, every status included. Upcoming ones aren't over yet, soonest first. Past ones
 *   are over, latest first. Upcoming is the default, with 20 to a page and at most 50.
 * - PATCH /api/reservations/:reservationId with { status: "CANCELLED" } cancels one, and answers it
 *   inside { reservation }. Refusals: 404 RESERVATION_NOT_FOUND (not this guest's), 409
 *   ALREADY_CANCELLED and 409 CANCEL_TOO_LATE (it has started, or the guest has arrived).
 * - POST /api/reservations/:reservationId/review reviews a visit: see ReviewResponse.
 */
export interface GuestReservation {
  id: string;
  status: ReservationStatus;
  partySize: number;
  /** The day it's for, on the restaurant's calendar. */
  date: string;
  startsAt: string;
  endsAt: string;
  /** On the restaurant's clock, ready to show, such as "23:30" and "01:00". */
  starts: string;
  ends: string;
  restaurant: { slug: string; name: string };
  table: { label: string; zone: TableZone };
  specialRequests: string | null;
  /** Who cancelled, and why, for a cancelled booking. Otherwise null. */
  cancellation: { by: "CUSTOMER" | "RESTAURANT" | null; reason: string | null } | null;
  /** Whether the guest can still cancel it: pending or confirmed, and not started yet. */
  canCancel: boolean;
  /** The guest's review of this visit, once they've written one. */
  review: { rating: number; comment: string | null } | null;
  /** Whether the guest can review it: the restaurant marked them arrived, and there's no review yet. */
  canReview: boolean;
}

export interface GuestReservationResponse {
  reservation: GuestReservation;
}

/**
 * POST /api/reservations/:reservationId/review, for the guest who made the booking, with
 * { rating: 1 to 5, comment?: up to 1000 characters }. It answers 201 with the review inside
 * { review }, and the restaurant's average and count change with it. Refusals: 404
 * RESERVATION_NOT_FOUND (not this guest's), 409 NOT_VISITED (not marked arrived) and 409
 * ALREADY_REVIEWED (one review per visit), and 400 with fields.rating or fields.comment.
 */
export interface GuestReview {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface ReviewResponse {
  review: GuestReview;
}

/**
 * A guest's favorites, at /api/favorites, for signed-in guests only (anyone else gets 401 or 403):
 * - GET /api/favorites?page=&pageSize= answers a ListResponse of RestaurantSummary, the last saved
 *   first, 12 to a page and at most 48. A restaurant that isn't published isn't listed or counted.
 * - GET /api/favorites/:slug says whether that restaurant is saved.
 * - PUT /api/favorites/:slug saves it, and DELETE takes it out. Both can be repeated safely. Saving
 *   a restaurant that isn't published answers 404 RESTAURANT_NOT_FOUND.
 */
export interface FavoriteState {
  saved: boolean;
}

/**
 * A review on a restaurant's page. GET /api/restaurants/:slug/reviews?page=&pageSize= answers a
 * ListResponse of them, newest first, 10 to a page and at most 50, for anyone. A restaurant that
 * isn't published answers 404 RESTAURANT_NOT_FOUND.
 */
export interface PublicReview {
  id: string;
  rating: number;
  comment: string | null;
  /** The guest's first name: all anyone else sees of them. */
  author: string;
  /** The day it was written, on the restaurant's calendar. */
  date: string;
  createdAt: string;
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
  /** 1 to 4. Only a demo listing (9.7), which nobody can sign in to manage, has none. */
  priceLevel: number | null;
  /** Minutes between the start times guests can choose. */
  slotIntervalMin: number;
  /** How long one booking holds its table, in minutes. */
  reservationDurationMin: number;
  isPublished: boolean;
  /** Seghan has hidden it: guests can't find or book it, even while it's published. */
  hiddenBySeghan: boolean;
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

/** A change a restaurant makes to one of its bookings (PROJECT_PLAN.md §5.3). */
export type RestaurantChange = "CONFIRMED" | "CANCELLED" | "ARRIVED" | "NO_SHOW";

/**
 * One booking in a restaurant's book for the day:
 * - GET /api/owner/restaurants/:restaurantId/reservations?date=YYYY-MM-DD answers a ListResponse
 *   of these: every status, by time and then table. A booking belongs to the date it starts on, on
 *   the restaurant's clock.
 * - PATCH …/reservations/:reservationId moves one on, and answers it inside { reservation }. Send
 *   { status: "CONFIRMED" } (before the start), { status: "CANCELLED", reason? } (any time; the
 *   guest sees the reason), { status: "ARRIVED" } (a confirmed booking from 30 minutes before
 *   the start, or a pending one while it's on) or { status: "NO_SHOW" } (a confirmed booking,
 *   after the start). Only a pending booking can be confirmed. Refusals: 404
 *   RESERVATION_NOT_FOUND, and 409 with what the booking already is (NOT_CONFIRMED,
 *   ALREADY_CONFIRMED, ALREADY_ARRIVED, ALREADY_NO_SHOW, ALREADY_CANCELLED) or the time
 *   (CONFIRM_TOO_LATE, ARRIVAL_TOO_EARLY, ARRIVAL_TOO_LATE, NO_SHOW_TOO_EARLY). Fetch the day
 *   again after a 409.
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
  /**
   * The changes the restaurant can make to it now, as the server decides them, so the dashboard
   * offers only those. The server still checks each one when it's sent.
   */
  actions: RestaurantChange[];
}

export interface OwnerReservationResponse {
  reservation: OwnerReservation;
}

/**
 * One of a restaurant's tables, as its owner manages them:
 * - GET /api/owner/restaurants/:restaurantId/tables answers a ListResponse of these, in the order
 *   they were added, active and inactive
 * - POST …/tables (201) and PATCH …/tables/:tableId answer { table }
 *
 * Tables are never deleted: PATCH { isActive: false } deactivates one, and { isActive: true }
 * brings it back. A published restaurant keeps at least one active table, so switching off its
 * last one answers 409 LAST_ACTIVE_TABLE. Someone else's table answers 404 TABLE_NOT_FOUND, and a
 * name another table of the restaurant has, even a deactivated one, answers 409 TABLE_LABEL_TAKEN.
 */
export interface OwnerTable {
  id: string;
  /** A short name, such as "T4" or "Terrace 2". */
  label: string;
  /** The most guests it seats. */
  capacity: number;
  /** The fewest guests it's offered to. */
  minCapacity: number;
  zone: TableZone;
  /** Inactive tables are never offered for new bookings. */
  isActive: boolean;
}

export interface OwnerTableResponse {
  table: OwnerTable;
}

/**
 * The `details` of a change refused because of bookings: those bookings, in the day view's shape.
 * The message already says what to do, such as "Keep at least 4 seats …".
 * - 409 TABLE_HAS_BOOKINGS: deactivating a table while upcoming bookings need it
 * - 409 TABLE_TOO_SMALL: fewer seats than a booked party, listing only the parties that won't fit
 * - 409 BLOCK_HAS_BOOKINGS: a block with upcoming bookings inside it
 */
export interface BookingsInTheWayDetails {
  reservations: OwnerReservation[];
}

/**
 * A time when one table, or the whole restaurant, can't be booked, such as a private event:
 * - GET /api/owner/restaurants/:restaurantId/blocks answers a ListResponse of these: the blocks
 *   that aren't over yet, by when they start
 * - POST …/blocks (201) answers { block }. Send { tableId?, date } for a whole date, or
 *   { tableId?, from, to } for a time range, in the restaurant's own time, such as
 *   { from: "2026-11-20T18:00", to: "2026-11-21T02:00" }. Leave tableId out to block the whole
 *   restaurant. Bookings inside it answer 409 BLOCK_HAS_BOOKINGS, with BookingsInTheWayDetails.
 * - DELETE …/blocks/:blockId answers 204. Someone else's block answers 404 BLOCK_NOT_FOUND.
 */
export interface OwnerBlock {
  id: string;
  /** The blocked table, or null when the whole restaurant is blocked. */
  table: { id: string; label: string; zone: TableZone } | null;
  /** The exact moments, in UTC. */
  startsAt: string;
  endsAt: string;
  /**
   * The same moments on the restaurant's calendar and clock, ready to show. A whole date runs from
   * 00:00 to 00:00 on the next day.
   */
  starts: { date: string; time: string };
  ends: { date: string; time: string };
  reason: string | null;
}

export interface OwnerBlockResponse {
  block: OwnerBlock;
}

/**
 * The `details` of 409 NOT_READY_TO_PUBLISH, when a PATCH tries to publish too early. The message
 * already says what to add, such as "Add your opening hours before you publish."
 */
export interface NotReadyToPublishDetails {
  missing: PublishBlocker[];
}

/** Who someone is on Seghan: a guest, a restaurant's owner, or Seghan's own team. */
export type UserRole = AuthUser["role"];

/**
 * Seghan's admin area (9.5), for admins only: anyone else gets 401 or 403. Lists take
 * ?page=&pageSize= (20 to a page, at most 50) and answer a ListResponse:
 * - GET /api/admin/users?q=&role= lists everyone, the newest first.
 * - GET /api/admin/restaurants?q=&show=published|draft|hidden lists every restaurant, by name.
 * - PATCH /api/admin/restaurants/:restaurantId with { hidden } hides it from guests, or shows it
 *   again, and answers it inside { restaurant }. 404 RESTAURANT_NOT_FOUND if there's no such one.
 * - GET /api/admin/reservations?q=&status=&date= lists every booking, the latest start first.
 */
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  /** Restaurants they own, and bookings they made. */
  restaurants: number;
  reservations: number;
}

export interface AdminRestaurant {
  id: string;
  slug: string;
  name: string;
  district: District;
  owner: { name: string; email: string };
  /** The owner's own choice. */
  isPublished: boolean;
  /** When Seghan hid it from guests, or null. */
  hiddenAt: string | null;
  /** A real restaurant listed from public data for the demo (9.7), which can't be booked. */
  isDemoListing: boolean;
  reservations: number;
  createdAt: string;
}

export interface AdminRestaurantResponse {
  restaurant: AdminRestaurant;
}

export interface AdminReservation {
  id: string;
  status: ReservationStatus;
  partySize: number;
  /** On the restaurant's calendar and clock, ready to show. */
  date: string;
  starts: string;
  ends: string;
  startsAt: string;
  endsAt: string;
  restaurant: { id: string; slug: string; name: string };
  table: { label: string };
  guest: { name: string; email: string };
  createdAt: string;
}

/** How many days the analytics cover: today and the days before it. */
export type AnalyticsDays = 7 | 30 | 90;

/**
 * Seghan's analytics (9.6), counted by the day each booking is for:
 * - GET /api/owner/restaurants/:restaurantId/analytics?days=7|30|90 answers one of the owner's
 *   restaurants inside { analytics }, on its own calendar. Someone else's is a 404.
 * - GET /api/admin/analytics?days= answers all of Seghan's, for admins only, with the most booked
 *   restaurants. Without ?days=, both count the last 30 days. Anything else is a 400 under days.
 */
export interface Analytics {
  /** The days counted, as YYYY-MM-DD. The last is today. */
  period: { days: AnalyticsDays; from: string; to: string };
  /** Every booking for those days, whatever became of it. */
  bookings: number;
  /** How many have each status. Every status is listed. */
  statuses: Record<ReservationStatus, number>;
  /** The people in the bookings marked arrived: the guests who came. */
  guests: number;
  /** The reviews of those bookings. */
  ratings: {
    count: number;
    /** Out of 5, unrounded, or null when there are none. */
    average: number | null;
    /** How many gave each rating, from 5 down to 1. */
    byRating: { rating: number; count: number }[];
  };
}

export interface AnalyticsResponse {
  analytics: Analytics;
}

export interface MostBookedRestaurant {
  id: string;
  slug: string;
  name: string;
  bookings: number;
}

export interface SeghanAnalytics extends Analytics {
  /** The restaurants with the most bookings for those days, the most first: at most 10. */
  restaurants: MostBookedRestaurant[];
}

export interface SeghanAnalyticsResponse {
  analytics: SeghanAnalytics;
}
