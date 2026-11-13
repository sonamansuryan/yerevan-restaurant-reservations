// Sample data for /design, shaped exactly like the API's answers. The six named ones are the demo
// restaurants, with their real hours, so /design and the real pages look alike.
import type {
  AdminReservation,
  AdminRestaurant,
  AdminUser,
  Analytics,
  Availability,
  AvailabilitySlot,
  AvailableTable,
  GuestReservation,
  OpeningHours,
  OwnerBlock,
  OwnerPhoto,
  OwnerReservation,
  OwnerRestaurant,
  OwnerTable,
  PublicReview,
  ReservationStatus,
  RestaurantDetail,
  RestaurantSummary,
  SeghanAnalytics,
} from "@/types/api";

const restaurant = (
  fields: Pick<RestaurantSummary, "slug" | "name" | "cuisines" | "district" | "priceLevel"> &
    Partial<RestaurantSummary>,
): RestaurantSummary => ({
  description: null,
  address: "Yerevan",
  avgRating: 0,
  reviewCount: 0,
  coverPhotoUrl: null,
  isDemoListing: false,
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

export const loriSmokehouse = restaurant({
  slug: "lori-smokehouse",
  name: "Lori Smokehouse",
  description: "Khorovats and slow-smoked meats, cooked over an open grill.",
  cuisines: ["ARMENIAN", "STEAKHOUSE"],
  district: "ARABKIR",
  address: "52 Komitas Avenue, Yerevan",
  priceLevel: 2,
  avgRating: 4.4,
  reviewCount: 18,
});

const nurr = restaurant({
  slug: "nurr",
  name: "Nurr",
  description: "Modern Armenian plates built around the season, in a warm dining room.",
  cuisines: ["ARMENIAN", "FUSION"],
  district: "KENTRON",
  address: "14 Pushkin Street, Yerevan",
  priceLevel: 3,
  avgRating: 4.6,
  reviewCount: 23,
});

const sevanAndSalt = restaurant({
  slug: "sevan-and-salt",
  name: "Sevan & Salt",
  description: "Trout and seafood from the lake and beyond, served simply.",
  cuisines: ["SEAFOOD"],
  district: "NOR_NORK",
  priceLevel: 3,
  avgRating: 4.8,
  reviewCount: 5,
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
  avgRating: 4,
  reviewCount: 1,
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
  osmUrl: null,
  mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${summary.name}, ${summary.address}`)}`,
  // As the API answers with maps set up. The screens that show a map pass it in themselves.
  mapImageUrl: `/api/restaurants/${summary.slug}/map`,
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

/** Lunch and dinner at the weekend, dinner only on weekdays, and closed on Monday. */
export const splitWeek: OpeningHours[] = [
  ...hours([5, 6, 0], 720, 900),
  ...hours([2, 3, 4, 5, 6, 0], 1080, 1380),
];

export const armenianPage = page(armenianName, {
  phone: "+37400000108",
  website: "https://www.example.com/sardarapat",
  openingHours: hours(EVERY_DAY, 660, 1320),
});

/** Rated by guests: Browse ordered by rating, the best first and those without reviews last. */
export const highestRated: RestaurantSummary[] = [
  sevanAndSalt,
  nurr,
  loriSmokehouse,
  tsiranWineRoom,
  kondHouse,
  tbilisiCourtyard,
];

export const reviewedPage = page(nurr, {
  phone: "+37400000101",
  openingHours: hours(EVERY_DAY, 720, 1380),
});

/** Nurr's newest reviews, as its page lists them: first names only, newest first. */
export const sampleReviews: PublicReview[] = [
  {
    id: "review-lilit",
    rating: 5,
    comment:
      "The lamb with apricots was the best thing we ate all week, and they remembered it was our anniversary.",
    author: "Lilit",
    date: "2026-11-08",
    createdAt: "2026-11-08T17:20:00.000Z",
  },
  {
    id: "review-anna",
    rating: 4,
    comment:
      "A warm room and a thoughtful wine list. Dessert took a while.\nWe’ll be back in spring.",
    author: "Աննա",
    date: "2026-11-02",
    createdAt: "2026-11-02T18:05:00.000Z",
  },
  {
    id: "review-aram",
    rating: 5,
    comment: null,
    author: "Aram",
    date: "2026-10-27",
    createdAt: "2026-10-27T19:40:00.000Z",
  },
  {
    id: "review-grigor",
    rating: 3,
    comment: "Good food, but the terrace was cold by nine.",
    author: "Grigor",
    date: "2026-10-19",
    createdAt: "2026-10-19T17:10:00.000Z",
  },
];

// The dashboard's samples: an owner's restaurants, one day in the book, and photos.

const owned = (
  summary: RestaurantSummary,
  extra: Pick<OwnerRestaurant, "id"> & Partial<OwnerRestaurant>,
): OwnerRestaurant => ({
  slug: summary.slug,
  name: summary.name,
  description: summary.description,
  cuisines: summary.cuisines,
  district: summary.district,
  address: summary.address,
  phone: null,
  website: null,
  priceLevel: summary.priceLevel,
  slotIntervalMin: 30,
  reservationDurationMin: 120,
  isPublished: true,
  hiddenBySeghan: false,
  ...extra,
});

export const ownedLori = owned(loriSmokehouse, {
  id: "4f1e2d3c-5b6a-4789-8a0b-1c2d3e4f5a6b",
  phone: "+374 10 000103",
});

/** A new restaurant, not published yet, with a long Armenian name. */
export const ownedDraft = owned(armenianName, {
  id: "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d",
  isPublished: false,
});

/** By name, as the API lists them: Latin letters sort before Armenian ones. */
export const ownedRestaurants: OwnerRestaurant[] = [
  ownedLori,
  owned(tsiranWineRoom, {
    id: "2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f",
    reservationDurationMin: 150,
  }),
  ownedDraft,
];

const T1 = { id: "table-t1", label: "T1", zone: "INDOOR" } as const;
const T2 = { id: "table-t2", label: "T2", zone: "INDOOR" } as const;
const T3 = { id: "table-t3", label: "T3", zone: "INDOOR" } as const;
const T4 = { id: "table-t4", label: "T4", zone: "TERRACE" } as const;
const T5 = { id: "table-t5", label: "T5", zone: "INDOOR" } as const;

/** One booking on Friday 13 November 2026. Yerevan is 4 hours ahead of UTC. */
function booking(
  id: string,
  [startsAt, starts]: [string, string],
  [endsAt, ends]: [string, string],
  guest: string,
  table: OwnerReservation["table"],
  partySize: number,
  status: ReservationStatus,
  extra: Partial<OwnerReservation> = {},
): OwnerReservation {
  return {
    id,
    status,
    partySize,
    startsAt,
    endsAt,
    starts,
    ends,
    table,
    guest: { name: guest },
    specialRequests: null,
    cancellation: null,
    actions: [],
    ...extra,
  };
}

/**
 * A full Friday, seen at 19:10: every status, notes, a cancellation with a reason, and a booking past
 * midnight. Each offers the changes the server would allow then.
 */
export const fridayBookings: OwnerReservation[] = [
  booking(
    "booking-1",
    ["2026-11-13T08:30:00.000Z", "12:30"],
    ["2026-11-13T10:30:00.000Z", "14:30"],
    "Lilit Harutyunyan",
    T1,
    2,
    "ARRIVED",
  ),
  booking(
    "booking-2",
    ["2026-11-13T09:00:00.000Z", "13:00"],
    ["2026-11-13T11:00:00.000Z", "15:00"],
    "Davit Grigoryan",
    T4,
    4,
    "NO_SHOW",
  ),
  booking(
    "booking-3",
    ["2026-11-13T15:00:00.000Z", "19:00"],
    ["2026-11-13T17:00:00.000Z", "21:00"],
    "Anahit Petrosyan",
    T3,
    4,
    "CONFIRMED",
    { specialRequests: "Birthday dinner", actions: ["CANCELLED", "ARRIVED", "NO_SHOW"] },
  ),
  booking(
    "booking-4",
    ["2026-11-13T15:30:00.000Z", "19:30"],
    ["2026-11-13T17:30:00.000Z", "21:30"],
    "Aram Khachatryan",
    T5,
    6,
    "PENDING",
    {
      specialRequests: "A table by the window, if possible",
      actions: ["CONFIRMED", "CANCELLED"],
    },
  ),
  booking(
    "booking-5",
    ["2026-11-13T16:00:00.000Z", "20:00"],
    ["2026-11-13T18:00:00.000Z", "22:00"],
    "Mariam Sargsyan",
    T2,
    2,
    "CANCELLED",
    { cancellation: { by: "RESTAURANT", reason: "We have a private event that evening." } },
  ),
  booking(
    "booking-6",
    ["2026-11-13T18:30:00.000Z", "22:30"],
    ["2026-11-13T20:30:00.000Z", "00:30"],
    "Գոհար Մկրտչյան",
    T1,
    2,
    "CONFIRMED",
    { actions: ["CANCELLED"] },
  ),
];

// index.css's photo tones, --color-tone-1 to --color-tone-6, written out because an <img> can't
// read CSS. Squares in these tones stand in for photos, so /design needs no network. A real photo
// is a Cloudinary address, which photoUrl() sizes; these pass through it unchanged.
const PHOTO_TONES = ["#5a2e24", "#4b2b33", "#3a3027", "#26363b", "#6b5a45", "#2a2622"];

function samplePhoto(index: number): OwnerPhoto {
  const from = PHOTO_TONES[index % PHOTO_TONES.length] ?? "#3a3027";
  const to = PHOTO_TONES[(index + 3) % PHOTO_TONES.length] ?? "#2a2622";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="4" height="4" fill="url(#g)"/></svg>`;
  return {
    id: `sample-photo-${index + 1}`,
    url: `data:image/svg+xml,${encodeURIComponent(svg)}`,
    isCover: index === 0,
    sortOrder: index,
  };
}

/** A cover and four more. */
export const samplePhotos: OwnerPhoto[] = Array.from({ length: 5 }, (_, index) =>
  samplePhoto(index),
);

/** As many as a restaurant can have. */
export const tenPhotos: OwnerPhoto[] = Array.from({ length: 10 }, (_, index) => samplePhoto(index));

// The Tables part: Lori Smokehouse's tables, as the bookings above use them, with one switched off,
// a long name, and every area.
const table = (
  id: string,
  label: string,
  [minCapacity, capacity]: [number, number],
  zone: OwnerTable["zone"],
  isActive = true,
): OwnerTable => ({ id, label, capacity, minCapacity, zone, isActive });

export const ownedTables: OwnerTable[] = [
  table(T1.id, T1.label, [2, 4], "INDOOR"),
  table(T2.id, T2.label, [1, 2], "INDOOR"),
  table(T3.id, T3.label, [2, 4], "INDOOR"),
  table(T5.id, T5.label, [4, 8], "INDOOR"),
  table("table-t6", "T6", [2, 4], "INDOOR", false),
  table(T4.id, T4.label, [3, 6], "TERRACE"),
  table("table-v1", "The long table", [6, 12], "VIP"),
  table("table-b1", "Bar 1", [1, 1], "BAR_COUNTER"),
];

/** A block as the API sends it. Yerevan is 4 hours ahead of UTC. */
function block(
  id: string,
  tableId: string | null,
  [startDate, startTime, startsAt]: [string, string, string],
  [endDate, endTime, endsAt]: [string, string, string],
  reason: string | null,
): OwnerBlock {
  const blocked = ownedTables.find((one) => one.id === tableId);
  return {
    id,
    table: blocked ? { id: blocked.id, label: blocked.label, zone: blocked.zone } : null,
    startsAt,
    endsAt,
    starts: { date: startDate, time: startTime },
    ends: { date: endDate, time: endTime },
    reason,
  };
}

/** One table for an evening, the whole restaurant past midnight, a whole day, and a holiday week. */
export const sampleBlocks: OwnerBlock[] = [
  block(
    "block-1",
    T4.id,
    ["2026-11-14", "18:00", "2026-11-14T14:00:00.000Z"],
    ["2026-11-14", "23:00", "2026-11-14T19:00:00.000Z"],
    "A wobbly leg",
  ),
  block(
    "block-2",
    null,
    ["2026-11-20", "18:00", "2026-11-20T14:00:00.000Z"],
    ["2026-11-21", "02:00", "2026-11-20T22:00:00.000Z"],
    "Private event",
  ),
  block(
    "block-3",
    null,
    ["2026-12-31", "00:00", "2026-12-30T20:00:00.000Z"],
    ["2027-01-01", "00:00", "2026-12-31T20:00:00.000Z"],
    null,
  ),
  block(
    "block-4",
    null,
    ["2027-01-01", "00:00", "2026-12-31T20:00:00.000Z"],
    ["2027-01-08", "00:00", "2027-01-07T20:00:00.000Z"],
    "Holiday week",
  ),
];

/** The tables free for two at Lori Smokehouse, as the availability lists them. */
const loriFree = {
  t1: { id: "table-t1", label: "T1", zone: "INDOOR", capacity: 4 },
  t2: { id: "table-t2", label: "T2", zone: "INDOOR", capacity: 2 },
  t3: { id: "table-t3", label: "T3", zone: "INDOOR", capacity: 4 },
  p1: { id: "table-p1", label: "P1", zone: "TERRACE", capacity: 4 },
} satisfies Record<string, AvailableTable>;

/** A two-hour booking from this time on Saturday 14 November, in Yerevan, 4 hours ahead of UTC. */
function saturdayAt(starts: string, tables: AvailableTable[]): AvailabilitySlot {
  const [hour = 0, minute = 0] = starts.split(":").map(Number);
  const startsAt = Date.UTC(2026, 10, 14, hour - 4, minute);
  return {
    startsAt: new Date(startsAt).toISOString(),
    endsAt: new Date(startsAt + 2 * 3_600_000).toISOString(),
    starts,
    ends: `${String(hour + 2).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    tables,
  };
}

const withoutT1 = [loriFree.t2, loriFree.t3, loriFree.p1];

/**
 * Lori Smokehouse on the demo Saturday, for two. T1 is booked for lunch at 12:30 and dinner at
 * 19:00, so it's free only at 21:00, and every table is taken at 13:00.
 */
export const loriSaturday: Availability = {
  date: "2026-11-14",
  partySize: 2,
  bookingWindow: { first: "2026-11-13", last: "2027-01-12" },
  slots: [
    saturdayAt("12:00", withoutT1),
    saturdayAt("12:30", withoutT1),
    saturdayAt("13:00", []),
    ...["18:00", "18:30", "19:00", "19:30", "20:00", "20:30"].map((time) =>
      saturdayAt(time, withoutT1),
    ),
    saturdayAt("21:00", [loriFree.t1, ...withoutT1]),
  ],
};

/** Lilit's booking for two at T2 on the demo Saturday, as the API answers it once made. */
export const sampleBooked: GuestReservation = {
  id: "booking-new",
  status: "PENDING",
  partySize: 2,
  date: "2026-11-14",
  startsAt: "2026-11-14T15:00:00.000Z",
  endsAt: "2026-11-14T17:00:00.000Z",
  starts: "19:00",
  ends: "21:00",
  restaurant: { slug: "lori-smokehouse", name: "Lori Smokehouse" },
  table: { label: "T2", zone: "INDOOR" },
  specialRequests: null,
  cancellation: null,
  canCancel: true,
  review: null,
  canReview: false,
};

/** A guest's booking as My reservations lists it: Lori's T2 on the demo Saturday unless told. */
function guestBooking(
  extra: Partial<GuestReservation> & Pick<GuestReservation, "id">,
): GuestReservation {
  return { ...sampleBooked, ...extra };
}

/** Lilit's upcoming bookings, seen on Wednesday 11 November 2026: two on Saturday, one cancelled. */
export const guestUpcoming: GuestReservation[] = [
  guestBooking({
    id: "upcoming-sevan",
    status: "CONFIRMED",
    partySize: 4,
    startsAt: "2026-11-14T09:00:00.000Z",
    endsAt: "2026-11-14T10:30:00.000Z",
    starts: "13:00",
    ends: "14:30",
    restaurant: { slug: "sevan-and-salt", name: "Sevan & Salt" },
    table: { label: "T3", zone: "INDOOR" },
  }),
  guestBooking({ id: "upcoming-lori", specialRequests: "A table by the window, please." }),
  guestBooking({
    id: "upcoming-tsiran",
    status: "CANCELLED",
    date: "2026-11-20",
    startsAt: "2026-11-20T19:30:00.000Z",
    endsAt: "2026-11-20T21:00:00.000Z",
    starts: "23:30",
    ends: "01:00",
    restaurant: { slug: "tsiran-wine-room", name: "Tsiran Wine Room" },
    table: { label: "B1", zone: "BAR_COUNTER" },
    cancellation: { by: "RESTAURANT", reason: "We’re closed for a private event that night." },
    canCancel: false,
  }),
  guestBooking({
    id: "upcoming-sardarapat",
    status: "CONFIRMED",
    partySize: 6,
    date: "2026-11-28",
    startsAt: "2026-11-28T16:00:00.000Z",
    endsAt: "2026-11-28T18:00:00.000Z",
    starts: "20:00",
    ends: "22:00",
    restaurant: { slug: armenianName.slug, name: armenianName.name },
    table: { label: "T5", zone: "TERRACE" },
  }),
];

/**
 * Lilit's past bookings, latest first, back to last New Year's Eve. Lori marked her arrived both
 * times: last Friday's visit waits for her review, and New Year's Eve has one.
 */
export const guestPast: GuestReservation[] = [
  guestBooking({
    id: "past-lori",
    status: "ARRIVED",
    date: "2026-11-06",
    startsAt: "2026-11-06T16:00:00.000Z",
    endsAt: "2026-11-06T18:00:00.000Z",
    starts: "20:00",
    ends: "22:00",
    table: { label: "T1", zone: "INDOOR" },
    canCancel: false,
    canReview: true,
  }),
  guestBooking({
    id: "past-kond",
    status: "NO_SHOW",
    partySize: 4,
    date: "2026-10-31",
    startsAt: "2026-10-31T15:30:00.000Z",
    endsAt: "2026-10-31T17:30:00.000Z",
    starts: "19:30",
    ends: "21:30",
    restaurant: { slug: "kond-house", name: "Kond House" },
    table: { label: "T3", zone: "INDOOR" },
    canCancel: false,
  }),
  guestBooking({
    id: "past-nurr",
    status: "CANCELLED",
    partySize: 3,
    date: "2026-10-23",
    startsAt: "2026-10-23T09:00:00.000Z",
    endsAt: "2026-10-23T11:00:00.000Z",
    starts: "13:00",
    ends: "15:00",
    restaurant: { slug: "nurr", name: "Nurr" },
    table: { label: "T4", zone: "TERRACE" },
    cancellation: { by: "CUSTOMER", reason: null },
    canCancel: false,
  }),
  guestBooking({
    id: "past-new-year",
    status: "ARRIVED",
    partySize: 6,
    date: "2025-12-31",
    startsAt: "2025-12-31T16:00:00.000Z",
    endsAt: "2025-12-31T18:00:00.000Z",
    starts: "20:00",
    ends: "22:00",
    table: { label: "T4", zone: "INDOOR" },
    canCancel: false,
    review: { rating: 5, comment: "The best table for New Year’s Eve, and the trout was perfect." },
  }),
];

// The admin's samples: restaurants, bookings and people across Seghan, as the admin's lists show
// them. Ani owns the demo restaurants and Davit the Armenian draft; Lilit and Aram are guests.

const ani = { name: "Ani Sargsyan", email: "ani.owner@example.com" };
const davit = { name: "Davit Hakobyan", email: "davit.owner@example.com" };

const listed = (
  summary: RestaurantSummary,
  extra: Pick<AdminRestaurant, "id" | "reservations"> & Partial<AdminRestaurant>,
): AdminRestaurant => ({
  slug: summary.slug,
  name: summary.name,
  district: summary.district,
  owner: ani,
  isPublished: true,
  hiddenAt: null,
  isDemoListing: false,
  createdAt: "2026-11-01T08:00:00.000Z",
  ...extra,
});

/** Tbilisi Courtyard, which Seghan hid on Tuesday 10 November, though Ani keeps it published. */
export const hiddenTbilisi = listed(tbilisiCourtyard, {
  id: "0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e",
  reservations: 6,
  hiddenAt: "2026-11-10T09:30:00.000Z",
});

/** By name, as the admin's list has them: Latin letters before Armenian ones. */
export const adminRestaurants: AdminRestaurant[] = [
  listed(kondHouse, { id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", reservations: 31 }),
  listed(loriSmokehouse, { id: "4f1e2d3c-5b6a-4789-8a0b-1c2d3e4f5a6b", reservations: 48 }),
  listed(nurr, { id: "5b6c7d8e-9f0a-4b1c-8d2e-3f4a5b6c7d8e", reservations: 27 }),
  hiddenTbilisi,
  listed(tsiranWineRoom, { id: "2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f", reservations: 12 }),
  listed(armenianName, {
    id: "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d",
    reservations: 0,
    owner: davit,
    isPublished: false,
    createdAt: "2026-11-11T07:15:00.000Z",
  }),
];

const placed = (
  id: string,
  restaurant: Pick<AdminRestaurant, "id" | "slug" | "name">,
  [date, starts, ends]: [string, string, string],
  [startsAt, endsAt]: [string, string],
  guest: AdminReservation["guest"],
  extra: Partial<AdminReservation> = {},
): AdminReservation => ({
  id,
  status: "CONFIRMED",
  partySize: 2,
  date,
  starts,
  ends,
  startsAt,
  endsAt,
  restaurant: { id: restaurant.id, slug: restaurant.slug, name: restaurant.name },
  table: { label: "T2" },
  guest,
  createdAt: "2026-11-09T10:00:00.000Z",
  ...extra,
});

const lilit = { name: "Lilit Harutyunyan", email: "lilit@example.com" };
const aram = { name: "Aram Petrosyan", email: "aram@example.com" };
const [kond, lori, nurrListed] = adminRestaurants as [
  AdminRestaurant,
  AdminRestaurant,
  AdminRestaurant,
];

/** The latest start first, as the admin's list has them. Yerevan is 4 hours ahead of UTC. */
export const adminReservations: AdminReservation[] = [
  placed(
    "admin-lori-sat",
    lori,
    ["2026-11-14", "23:30", "01:30"],
    ["2026-11-14T19:30:00.000Z", "2026-11-14T21:30:00.000Z"],
    lilit,
    { status: "PENDING", partySize: 4, table: { label: "T4" } },
  ),
  placed(
    "admin-kond-fri",
    kond,
    ["2026-11-13", "19:00", "21:00"],
    ["2026-11-13T15:00:00.000Z", "2026-11-13T17:00:00.000Z"],
    aram,
  ),
  placed(
    "admin-nurr-thu",
    nurrListed,
    ["2026-11-12", "20:00", "22:00"],
    ["2026-11-12T16:00:00.000Z", "2026-11-12T18:00:00.000Z"],
    lilit,
    { status: "CANCELLED", partySize: 3, table: { label: "T1" } },
  ),
  placed(
    "admin-lori-tue",
    lori,
    ["2026-11-10", "13:00", "15:00"],
    ["2026-11-10T09:00:00.000Z", "2026-11-10T11:00:00.000Z"],
    aram,
    { status: "ARRIVED", table: { label: "T3" } },
  ),
  placed(
    "admin-kond-mon",
    kond,
    ["2026-11-09", "19:30", "21:30"],
    ["2026-11-09T15:30:00.000Z", "2026-11-09T17:30:00.000Z"],
    lilit,
    { status: "NO_SHOW", partySize: 6, table: { label: "T5" } },
  ),
];

const person = (
  id: string,
  name: string,
  email: string,
  role: AdminUser["role"],
  createdAt: string,
  extra: Partial<AdminUser> = {},
): AdminUser => ({ id, name, email, role, createdAt, restaurants: 0, reservations: 0, ...extra });

/** The newest first, as the admin's list has them. */
export const adminUsers: AdminUser[] = [
  person("user-davit", davit.name, davit.email, "OWNER", "2026-11-11T07:00:00.000Z", {
    restaurants: 1,
  }),
  person("user-aram", aram.name, aram.email, "CUSTOMER", "2026-11-05T12:20:00.000Z", {
    reservations: 2,
  }),
  person(
    "user-long",
    "Հովհաննեսյանց Մկրտչյան-Շահումյան",
    "hovhannisyants.mkrtchyan-shahumyan@example.com",
    "CUSTOMER",
    "2026-11-03T18:45:00.000Z",
  ),
  person("user-lilit", lilit.name, lilit.email, "CUSTOMER", "2026-11-02T09:10:00.000Z", {
    reservations: 3,
  }),
  person("user-ani", ani.name, ani.email, "OWNER", "2026-11-01T08:00:00.000Z", {
    restaurants: 5,
  }),
  person("user-admin", "Demo Admin", "admin@example.com", "ADMIN", "2025-12-20T08:00:00.000Z"),
];

// The analytics' samples (9.6): Lori Smokehouse's numbers, as Ani's dashboard counts them, and all
// of Seghan's, as the admin's do. Each adds up: the statuses make the bookings, the ratings make
// their count, and Seghan's most booked make its bookings. Today is Wednesday 11 November.

const ratingCounts = (five: number, four: number, three: number, two: number, one: number) =>
  [five, four, three, two, one].map((count, index) => ({ rating: 5 - index, count }));

function counted(
  period: Analytics["period"],
  statuses: Analytics["statuses"],
  guests: number,
  byRating: Analytics["ratings"]["byRating"] = ratingCounts(0, 0, 0, 0, 0),
): Analytics {
  const count = byRating.reduce((sum, one) => sum + one.count, 0);
  const total = byRating.reduce((sum, one) => sum + one.rating * one.count, 0);
  return {
    period,
    bookings: Object.values(statuses).reduce((sum, one) => sum + one, 0),
    statuses,
    guests,
    ratings: { count, average: count > 0 ? total / count : null, byRating },
  };
}

const lastWeek = { days: 7, from: "2026-11-05", to: "2026-11-11" } as const;
const lastMonth = { days: 30, from: "2026-10-13", to: "2026-11-11" } as const;
const lastSeason = { days: 90, from: "2026-08-14", to: "2026-11-11" } as const;

/** Lori's last 7, 30 and 90 days, by the period's days. */
export const loriAnalytics: Record<7 | 30 | 90, Analytics> = {
  7: counted(
    lastWeek,
    { PENDING: 1, CONFIRMED: 2, ARRIVED: 2, NO_SHOW: 0, CANCELLED: 1 },
    5,
    ratingCounts(1, 0, 0, 0, 0),
  ),
  30: counted(
    lastMonth,
    { PENDING: 1, CONFIRMED: 3, ARRIVED: 13, NO_SHOW: 1, CANCELLED: 3 },
    38,
    ratingCounts(5, 2, 0, 0, 1),
  ),
  90: counted(
    lastSeason,
    { PENDING: 1, CONFIRMED: 3, ARRIVED: 47, NO_SHOW: 4, CANCELLED: 9 },
    131,
    ratingCounts(18, 8, 1, 1, 1),
  ),
};

/** A new restaurant's first week: a few bookings, and nobody has written a review yet. */
export const firstWeekAnalytics = counted(
  lastWeek,
  { PENDING: 1, CONFIRMED: 2, ARRIVED: 1, NO_SHOW: 0, CANCELLED: 0 },
  2,
);

/** Days with no bookings at all. */
export const quietAnalytics = (period: Analytics["period"] = lastMonth): Analytics =>
  counted(period, { PENDING: 0, CONFIRMED: 0, ARRIVED: 0, NO_SHOW: 0, CANCELLED: 0 }, 0);

const booked = (one: AdminRestaurant, bookings: number) => ({
  id: one.id,
  slug: one.slug,
  name: one.name,
  bookings,
});
const [kondListed, loriListed, nurrRanked, , tsiranListed, armenianDraft] = adminRestaurants as [
  AdminRestaurant,
  AdminRestaurant,
  AdminRestaurant,
  AdminRestaurant,
  AdminRestaurant,
  AdminRestaurant,
];

/** All of Seghan's last 30 days, with Lori's 21 bookings among them. */
export const seghanAnalytics: SeghanAnalytics = {
  ...counted(
    lastMonth,
    { PENDING: 2, CONFIRMED: 7, ARRIVED: 36, NO_SHOW: 3, CANCELLED: 8 },
    94,
    ratingCounts(12, 5, 1, 0, 1),
  ),
  restaurants: [
    booked(loriListed, 21),
    booked(kondListed, 14),
    booked(nurrRanked, 12),
    booked(tsiranListed, 6),
    booked(hiddenTbilisi, 3),
  ],
};

/** The same, with a long Armenian name among the most booked, to see it wrap. */
export const seghanWithLongName: SeghanAnalytics = {
  ...seghanAnalytics,
  restaurants: [
    booked(loriListed, 21),
    booked(kondListed, 14),
    booked(armenianDraft, 9),
    booked(tsiranListed, 6),
    booked(hiddenTbilisi, 3),
  ],
  bookings: 53,
  statuses: { PENDING: 2, CONFIRMED: 7, ARRIVED: 33, NO_SHOW: 3, CANCELLED: 8 },
};

// The demo listings' samples (9.7): real Yerevan restaurants listed from OpenStreetMap and public
// listings, with photos from Wikimedia Commons or the restaurant's own site, credited. They aren't
// on Seghan, so they have no price, and their sample tables are only for trying the booking out.
// The photos stand in as tones, as everywhere in /design.

const [entrance, room, flags] = [samplePhoto(1), samplePhoto(3), samplePhoto(4)];

/** Dolmama, on Browse: a demo listing, so no price. */
export const dolmamaListing = restaurant({
  slug: "dolmama",
  name: "Dolmama",
  cuisines: ["ARMENIAN"],
  district: "KENTRON",
  address: "10 Pushkin Street, Yerevan",
  priceLevel: null,
  coverPhotoUrl: entrance.url,
  isDemoListing: true,
});

/** Mayrig, on Browse: a demo listing with no photo on Commons, so a menu cover. */
export const mayrigListing = restaurant({
  slug: "mayrig",
  name: "Mayrig",
  cuisines: ["MIDDLE_EASTERN"],
  district: "KENTRON",
  address: "4/6 King Pap Street, Yerevan",
  priceLevel: null,
  isDemoListing: true,
});

const commons = (photo: OwnerPhoto, credit: string, file: string) => ({
  url: photo.url,
  isCover: photo.isCover,
  credit,
  creditUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file)}`,
});

/** Dolmama's page: its photos credited, its hours and contacts from OpenStreetMap. */
export const dolmamaPage = page(dolmamaListing, {
  phone: "+374 10 56 13 54",
  website: "https://www.dolmama.am/",
  openingHours: hours(EVERY_DAY, 660, 1440),
  photos: [
    commons({ ...entrance, isCover: true }, "Benoît Prieur, CC0", "Dolmama entrance.jpg"),
    commons(room, "Benoît Prieur, CC0", "Dolmama.jpg"),
    commons(flags, "Sebleouf, CC BY-SA 4.0", "Dolmama flags.jpg"),
  ],
  osmUrl: "https://www.openstreetmap.org/node/6566646015",
});

/** Mayrig's page: no photo, so its cover is its name, on its tone. */
export const mayrigPage = page(mayrigListing, {
  website: "http://mayrig.am",
  openingHours: hours(EVERY_DAY, 450, 1440),
  osmUrl: "https://www.openstreetmap.org/node/6213329732",
});

// A square sample photo, standing in for Gustav's bar with its sign at the top.
const bar = samplePhoto(2);

/** Gustav, on Browse: a demo listing whose square cover is shown whole (covers.ts). */
export const gustavListing = restaurant({
  slug: "gustav",
  name: "Gustav",
  cuisines: ["EUROPEAN"],
  district: "KENTRON",
  address: "38 Isahakyan Street, Yerevan",
  priceLevel: null,
  coverPhotoUrl: bar.url,
  isDemoListing: true,
  description:
    "A French-inspired bistro and cocktail bar by the Cascade, opened in 2023. Its menu runs from smashed burgers to the Gustav Pan, with a sauce of 30 herbs.",
});

/** Gustav's page: its square cover shown whole, credited to its site. */
export const gustavPage = page(gustavListing, {
  website: "https://gustav.am/",
  openingHours: hours(EVERY_DAY, 690, 1440),
  photos: [
    { url: bar.url, isCover: true, credit: "Gustav’s website", creditUrl: "https://gustav.am/" },
  ],
  osmUrl: "https://www.openstreetmap.org/node/12246284869",
});

/** Dolmama in the admin's list: owned by the account nobody can sign in to. */
export const dolmamaListed: AdminRestaurant = {
  id: "9c8b7a6f-5e4d-4c3b-8a29-1f0e9d8c7b6a",
  slug: "dolmama",
  name: "Dolmama",
  district: "KENTRON",
  owner: { name: "Seghan demo listings", email: "listings@example.com" },
  isPublished: true,
  hiddenAt: null,
  isDemoListing: true,
  reservations: 0,
  createdAt: "2026-11-12T09:00:00.000Z",
};

/**
 * Kamancha's page: a well-known place no source gives everything for. OpenStreetMap has its address
 * but no cuisine or hours, and Commons has no photo, so the page shows none of them, never guesses.
 */
export const kamanchaPage = page(
  restaurant({
    slug: "kamancha",
    name: "Kamancha",
    cuisines: [],
    district: "KENTRON",
    address: "23 Tumanyan Street, Yerevan",
    priceLevel: null,
    isDemoListing: true,
  }),
  { osmUrl: "https://www.openstreetmap.org/node/9743330447" },
);

// Five different tones: there are six, so any five in a row differ.
const [kitchen, steak, breakfast, tea, tonir] = [
  samplePhoto(1),
  samplePhoto(2),
  samplePhoto(3),
  samplePhoto(4),
  samplePhoto(5),
];
const YEREMYAN_SHEREP = "https://www.yeremyanprojects.com/en/restaurants/sherep";

/**
 * Sherep's page: four photos from its restaurant group's own site, credited to it once, and one
 * from Commons, with its author and license.
 */
export const sherepPage = page(
  restaurant({
    slug: "sherep",
    name: "Sherep",
    cuisines: ["FUSION"],
    district: "KENTRON",
    address: "1 King Pap Street, Yerevan",
    priceLevel: null,
    coverPhotoUrl: kitchen.url,
    isDemoListing: true,
  }),
  {
    description:
      "By Republic Square, where the old Armenia café stood: an open kitchen and a tonir, and dishes from many countries rather than one.",
    openingHours: hours(EVERY_DAY, 570, 1440),
    photos: [
      ...[kitchen, steak, breakfast, tea].map((photo, index) => ({
        url: photo.url,
        isCover: index === 0,
        credit: "Yeremyan Projects’ website",
        creditUrl: YEREMYAN_SHEREP,
      })),
      commons(tonir, "Benoît Prieur, CC0", "Lavash baking in a restaurant (Yerevan) June 2023.jpg"),
    ],
    osmUrl: "https://www.openstreetmap.org/node/5299493124",
  },
);

/** Yasaman's page: not in OpenStreetMap, so its details come from public listings alone. */
export const yasamanPage = page(
  restaurant({
    slug: "yasaman",
    name: "Yasaman",
    cuisines: ["ARMENIAN"],
    district: "KENTRON",
    address: "1/1 Yekmalyan Street, Yerevan",
    priceLevel: null,
    isDemoListing: true,
  }),
  {
    description:
      "Traditional Armenian dishes with some European ones, from sturgeon kebab to dolma and lahmajo. Yasaman also has restaurants in Tsaghkadzor and Sevan.",
    phone: "+374 55 803344",
    website: "https://www.yasaman.am/",
    openingHours: hours(EVERY_DAY, 600, 1440),
    osmUrl: null,
  },
);
