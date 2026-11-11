// Sample data for /design, shaped exactly like the API's answers. The six named ones are the demo
// restaurants, with their real hours, so /design and the real pages look alike.
import type {
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
  ReservationStatus,
  RestaurantDetail,
  RestaurantSummary,
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

export const reviewedPage = page(nurr, {
  avgRating: 4.6,
  reviewCount: 23,
  phone: "+37400000101",
  openingHours: hours(EVERY_DAY, 720, 1380),
});

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

/** Lilit's past bookings, latest first, back to last New Year's Eve. */
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
  }),
];
