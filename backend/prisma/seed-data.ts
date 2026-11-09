// The demo data, kept apart from seed.ts so tests can check it without a database. Importing
// seed.ts would run it.
import type {
  CancelledBy,
  Cuisine,
  District,
  ReservationStatus,
  Role,
  TableZone,
} from "../src/generated/prisma/enums.ts";
import { addDays, dayOfWeek, localDate, localTimeToUtc } from "../src/lib/time.ts";

/** The only database the seed will write to. */
export const SEED_DATABASE = "yerevan_dev";

export const TIME_ZONE = "Asia/Yerevan";

const SUN = 0;
const MON = 1;
const TUE = 2;
const WED = 3;
const THU = 4;
const FRI = 5;
const SAT = 6;
const EVERY_DAY = [SUN, MON, TUE, WED, THU, FRI, SAT];

/** Minutes after the service day's midnight, so at(26) is 02:00 the next morning. */
const at = (hour: number, minute = 0): number => hour * 60 + minute;

/** Reservation ids are fixed, so a second run finds the same rows instead of adding new ones. */
const seedId = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export interface SeedUser {
  email: string;
  name: string;
  phone: string | null;
  role: Role;
}

interface SeedTable {
  label: string;
  capacity: number;
  minCapacity: number;
  zone: TableZone;
  isActive?: boolean;
}

interface SeedHours {
  days: number[];
  opensAt: number;
  closesAt: number;
}

export interface SeedRestaurant {
  slug: string;
  name: string;
  description: string;
  ownerEmail: string;
  cuisines: Cuisine[];
  district: District;
  address: string;
  phone: string;
  priceLevel: number;
  slotIntervalMin: number;
  reservationDurationMin: number;
  isPublished: boolean;
  tables: SeedTable[];
  hours: SeedHours[];
}

interface SeedReservation {
  id: string;
  restaurant: string;
  table: string;
  customer: string;
  partySize: number;
  /** The service day, so a booking can never land on a day the restaurant is closed. */
  weekday: number;
  /** 1 is the next such weekday after today, 2 the one after. -1 is the last one before today. */
  weeks: number;
  /** Minutes from the service day's midnight. Above 1440 means after midnight. */
  startMinutes: number;
  status: ReservationStatus;
  specialRequests?: string;
  cancellation?: { by: CancelledBy; reason?: string };
}

// All addresses use example.com, which is reserved and can never reach a real person. The phone
// numbers use a prefix that isn't assigned in Armenia. Every account signs in with DEMO_PASSWORD
// from backend/.env, which seed.ts hashes, so no password is ever written here.
export const USERS: SeedUser[] = [
  { email: "admin@example.com", name: "Demo Admin", phone: null, role: "ADMIN" },
  { email: "ani.owner@example.com", name: "Ani Sargsyan", phone: "+37400000001", role: "OWNER" },
  {
    email: "davit.owner@example.com",
    name: "Davit Grigoryan",
    phone: "+37400000002",
    role: "OWNER",
  },
  {
    email: "lilit@example.com",
    name: "Lilit Harutyunyan",
    phone: "+37400000003",
    role: "CUSTOMER",
  },
  { email: "aram@example.com", name: "Aram Petrosyan", phone: "+37400000004", role: "CUSTOMER" },
  // No phone on purpose, for the "add your phone number" step when booking.
  { email: "mane@example.com", name: "Mane Avetisyan", phone: null, role: "CUSTOMER" },
];

// Every restaurant here is fictional.
export const RESTAURANTS: SeedRestaurant[] = [
  {
    slug: "nurr",
    name: "Nurr",
    description: "Modern Armenian plates built around the season, in a warm dining room.",
    ownerEmail: "ani.owner@example.com",
    cuisines: ["ARMENIAN", "FUSION"],
    district: "KENTRON",
    address: "14 Pushkin Street, Yerevan",
    phone: "+37400000101",
    priceLevel: 3,
    slotIntervalMin: 30,
    reservationDurationMin: 120,
    isPublished: true,
    tables: [
      { label: "T1", capacity: 2, minCapacity: 1, zone: "INDOOR" },
      { label: "T2", capacity: 2, minCapacity: 1, zone: "INDOOR" },
      { label: "T3", capacity: 4, minCapacity: 2, zone: "INDOOR" },
      { label: "T4", capacity: 4, minCapacity: 2, zone: "TERRACE" },
      { label: "T5", capacity: 6, minCapacity: 3, zone: "INDOOR" },
      // Out of service, to show that an inactive table is never offered.
      { label: "T6", capacity: 4, minCapacity: 2, zone: "INDOOR", isActive: false },
    ],
    hours: [{ days: EVERY_DAY, opensAt: at(12), closesAt: at(23) }],
  },
  {
    slug: "tsiran-wine-room",
    name: "Tsiran Wine Room",
    description: "Armenian wines by the glass, with small plates until late at the weekend.",
    ownerEmail: "ani.owner@example.com",
    cuisines: ["ARMENIAN", "EUROPEAN"],
    district: "KENTRON",
    address: "31 Saryan Street, Yerevan",
    phone: "+37400000102",
    priceLevel: 2,
    slotIntervalMin: 30,
    reservationDurationMin: 90,
    isPublished: true,
    tables: [
      { label: "B1", capacity: 2, minCapacity: 1, zone: "BAR_COUNTER" },
      { label: "B2", capacity: 2, minCapacity: 1, zone: "BAR_COUNTER" },
      { label: "T1", capacity: 2, minCapacity: 1, zone: "INDOOR" },
      { label: "T2", capacity: 4, minCapacity: 2, zone: "INDOOR" },
      { label: "T3", capacity: 6, minCapacity: 3, zone: "INDOOR" },
    ],
    // Closes after midnight on Friday and Saturday, and doesn't open on Monday.
    hours: [
      { days: [SUN, TUE, WED, THU], opensAt: at(18), closesAt: at(23) },
      { days: [FRI, SAT], opensAt: at(18), closesAt: at(26) },
    ],
  },
  {
    slug: "lori-smokehouse",
    name: "Lori Smokehouse",
    description: "Khorovats and slow-smoked meats, cooked over an open grill.",
    ownerEmail: "ani.owner@example.com",
    cuisines: ["ARMENIAN", "STEAKHOUSE"],
    district: "ARABKIR",
    address: "52 Komitas Avenue, Yerevan",
    phone: "+37400000103",
    priceLevel: 2,
    slotIntervalMin: 30,
    reservationDurationMin: 120,
    isPublished: true,
    tables: [
      { label: "T1", capacity: 4, minCapacity: 2, zone: "INDOOR" },
      { label: "T2", capacity: 4, minCapacity: 2, zone: "INDOOR" },
      { label: "T3", capacity: 4, minCapacity: 2, zone: "INDOOR" },
      { label: "T4", capacity: 6, minCapacity: 3, zone: "INDOOR" },
      { label: "T5", capacity: 8, minCapacity: 4, zone: "INDOOR" },
      { label: "P1", capacity: 4, minCapacity: 2, zone: "TERRACE" },
    ],
    // Split shifts: open for lunch and dinner, and closed in between.
    hours: [
      { days: EVERY_DAY, opensAt: at(12), closesAt: at(15) },
      { days: EVERY_DAY, opensAt: at(18), closesAt: at(23) },
    ],
  },
  {
    slug: "sevan-and-salt",
    name: "Sevan & Salt",
    description: "Trout and seafood from the lake and beyond, served simply.",
    ownerEmail: "davit.owner@example.com",
    cuisines: ["SEAFOOD"],
    district: "NOR_NORK",
    address: "8 Gai Avenue, Yerevan",
    phone: "+37400000104",
    priceLevel: 3,
    slotIntervalMin: 15,
    reservationDurationMin: 90,
    isPublished: true,
    tables: [
      { label: "T1", capacity: 2, minCapacity: 1, zone: "INDOOR" },
      { label: "T2", capacity: 2, minCapacity: 1, zone: "INDOOR" },
      { label: "T3", capacity: 4, minCapacity: 2, zone: "INDOOR" },
      { label: "T4", capacity: 4, minCapacity: 2, zone: "INDOOR" },
      { label: "T5", capacity: 6, minCapacity: 3, zone: "TERRACE" },
    ],
    hours: [{ days: EVERY_DAY, opensAt: at(13), closesAt: at(22) }],
  },
  {
    slug: "kond-house",
    name: "Kond House",
    description: "Shared Middle Eastern plates for bigger groups, around a quiet courtyard.",
    ownerEmail: "davit.owner@example.com",
    cuisines: ["MIDDLE_EASTERN"],
    district: "KENTRON",
    address: "5 Paronyan Street, Yerevan",
    phone: "+37400000105",
    priceLevel: 2,
    slotIntervalMin: 30,
    reservationDurationMin: 120,
    isPublished: true,
    tables: [
      { label: "T1", capacity: 4, minCapacity: 2, zone: "INDOOR" },
      { label: "T2", capacity: 4, minCapacity: 2, zone: "INDOOR" },
      { label: "T3", capacity: 6, minCapacity: 4, zone: "INDOOR" },
      { label: "T4", capacity: 8, minCapacity: 5, zone: "INDOOR" },
      { label: "V1", capacity: 10, minCapacity: 6, zone: "VIP" },
    ],
    hours: [{ days: EVERY_DAY, opensAt: at(11), closesAt: at(22) }],
  },
  {
    slug: "tbilisi-courtyard",
    name: "Tbilisi Courtyard",
    description: "Khachapuri, khinkali and Georgian wine at everyday prices.",
    ownerEmail: "davit.owner@example.com",
    cuisines: ["GEORGIAN"],
    district: "MALATIA_SEBASTIA",
    address: "77 Sebastia Street, Yerevan",
    phone: "+37400000106",
    priceLevel: 1,
    slotIntervalMin: 30,
    reservationDurationMin: 90,
    isPublished: true,
    tables: [
      { label: "T1", capacity: 2, minCapacity: 1, zone: "INDOOR" },
      { label: "T2", capacity: 4, minCapacity: 2, zone: "INDOOR" },
      { label: "T3", capacity: 4, minCapacity: 2, zone: "INDOOR" },
      { label: "T4", capacity: 6, minCapacity: 3, zone: "INDOOR" },
      { label: "T5", capacity: 6, minCapacity: 3, zone: "TERRACE" },
    ],
    hours: [{ days: [MON, TUE, WED, THU, FRI, SAT], opensAt: at(11), closesAt: at(22) }],
  },
  {
    slug: "davtashen-test-kitchen",
    name: "Davtashen Test Kitchen",
    description: "A vegetarian kitchen that hasn't opened yet.",
    ownerEmail: "davit.owner@example.com",
    cuisines: ["VEGETARIAN"],
    district: "DAVTASHEN",
    address: "19 Davtashen 3rd Block, Yerevan",
    phone: "+37400000107",
    priceLevel: 2,
    slotIntervalMin: 30,
    reservationDurationMin: 90,
    // Unpublished on purpose: customers must never see this one.
    isPublished: false,
    tables: [
      { label: "T1", capacity: 2, minCapacity: 1, zone: "INDOOR" },
      { label: "T2", capacity: 4, minCapacity: 2, zone: "INDOOR" },
      { label: "T3", capacity: 4, minCapacity: 2, zone: "INDOOR" },
      { label: "T4", capacity: 6, minCapacity: 3, zone: "INDOOR" },
    ],
    hours: [{ days: EVERY_DAY, opensAt: at(12), closesAt: at(22) }],
  },
];

export const RESERVATIONS: SeedReservation[] = [
  // Requests the owner hasn't answered yet.
  {
    id: seedId(1),
    restaurant: "nurr",
    table: "T3",
    customer: "lilit@example.com",
    partySize: 4,
    weekday: THU,
    weeks: 1,
    startMinutes: at(19),
    status: "PENDING",
    specialRequests: "Birthday dinner",
  },
  {
    // On the 15-minute grid.
    id: seedId(2),
    restaurant: "sevan-and-salt",
    table: "T3",
    customer: "aram@example.com",
    partySize: 3,
    weekday: SAT,
    weeks: 1,
    startMinutes: at(19, 15),
    status: "PENDING",
  },
  {
    id: seedId(3),
    restaurant: "tbilisi-courtyard",
    table: "T2",
    customer: "mane@example.com",
    partySize: 2,
    weekday: TUE,
    weeks: 1,
    startMinutes: at(13),
    status: "PENDING",
  },

  // Confirmed. The first two are back to back on one table, which must be allowed.
  {
    id: seedId(4),
    restaurant: "nurr",
    table: "T4",
    customer: "aram@example.com",
    partySize: 4,
    weekday: FRI,
    weeks: 1,
    startMinutes: at(18),
    status: "CONFIRMED",
  },
  {
    id: seedId(5),
    restaurant: "nurr",
    table: "T4",
    customer: "mane@example.com",
    partySize: 2,
    weekday: FRI,
    weeks: 1,
    startMinutes: at(20),
    status: "CONFIRMED",
    specialRequests: "A table by the window, if possible",
  },
  {
    // Friday's service, so this starts at 00:00 on Saturday morning.
    id: seedId(6),
    restaurant: "tsiran-wine-room",
    table: "T2",
    customer: "lilit@example.com",
    partySize: 3,
    weekday: FRI,
    weeks: 1,
    startMinutes: at(24),
    status: "CONFIRMED",
  },
  {
    // Lunch and dinner on the same table, one in each shift.
    id: seedId(7),
    restaurant: "lori-smokehouse",
    table: "T1",
    customer: "aram@example.com",
    partySize: 4,
    weekday: SAT,
    weeks: 1,
    startMinutes: at(12, 30),
    status: "CONFIRMED",
  },
  {
    id: seedId(8),
    restaurant: "lori-smokehouse",
    table: "T1",
    customer: "lilit@example.com",
    partySize: 3,
    weekday: SAT,
    weeks: 1,
    startMinutes: at(19),
    status: "CONFIRMED",
  },

  // Past visits the guests came to.
  {
    id: seedId(9),
    restaurant: "nurr",
    table: "T1",
    customer: "lilit@example.com",
    partySize: 2,
    weekday: WED,
    weeks: -1,
    startMinutes: at(19, 30),
    status: "ARRIVED",
  },
  {
    id: seedId(10),
    restaurant: "kond-house",
    table: "T3",
    customer: "aram@example.com",
    partySize: 5,
    weekday: SUN,
    weeks: -1,
    startMinutes: at(13),
    status: "ARRIVED",
  },
  {
    id: seedId(11),
    restaurant: "tsiran-wine-room",
    table: "T1",
    customer: "mane@example.com",
    partySize: 2,
    weekday: THU,
    weeks: -1,
    startMinutes: at(20),
    status: "ARRIVED",
  },
  {
    id: seedId(12),
    restaurant: "sevan-and-salt",
    table: "T1",
    customer: "lilit@example.com",
    partySize: 2,
    weekday: TUE,
    weeks: -2,
    startMinutes: at(14, 30),
    status: "ARRIVED",
  },

  // Past bookings the guests never came to.
  {
    id: seedId(13),
    restaurant: "lori-smokehouse",
    table: "T2",
    customer: "mane@example.com",
    partySize: 2,
    weekday: FRI,
    weeks: -1,
    startMinutes: at(19),
    status: "NO_SHOW",
  },
  {
    id: seedId(14),
    restaurant: "nurr",
    table: "T2",
    customer: "aram@example.com",
    partySize: 2,
    weekday: MON,
    weeks: -1,
    startMinutes: at(13),
    status: "NO_SHOW",
  },

  // Cancelled. The first overlaps booking 1 on purpose, because a cancelled row frees the table.
  {
    id: seedId(15),
    restaurant: "nurr",
    table: "T3",
    customer: "mane@example.com",
    partySize: 3,
    weekday: THU,
    weeks: 1,
    startMinutes: at(19),
    status: "CANCELLED",
    cancellation: { by: "CUSTOMER" },
  },
  {
    id: seedId(16),
    restaurant: "tbilisi-courtyard",
    table: "T4",
    customer: "lilit@example.com",
    partySize: 5,
    weekday: WED,
    weeks: 1,
    startMinutes: at(18),
    status: "CANCELLED",
    cancellation: { by: "RESTAURANT", reason: "We have a private event that evening." },
  },
  {
    id: seedId(17),
    restaurant: "sevan-and-salt",
    table: "T2",
    customer: "aram@example.com",
    partySize: 2,
    weekday: SUN,
    weeks: -1,
    startMinutes: at(15),
    status: "CANCELLED",
    cancellation: { by: "CUSTOMER" },
  },
  {
    id: seedId(18),
    restaurant: "kond-house",
    table: "T1",
    customer: "lilit@example.com",
    partySize: 3,
    weekday: MON,
    weeks: 2,
    startMinutes: at(12, 30),
    status: "CANCELLED",
    cancellation: { by: "CUSTOMER" },
  },
];

/** One row per opening period, the shape the OpeningHour table stores. */
export function openingHoursFor(
  restaurant: SeedRestaurant,
): { dayOfWeek: number; opensAt: number; closesAt: number }[] {
  return restaurant.hours.flatMap(({ days, opensAt, closesAt }) =>
    days.map((day) => ({ dayOfWeek: day, opensAt, closesAt })),
  );
}

// Future bookings start after today and past ones before it, so a booking's status always matches
// its date, whatever day the seed runs.
function serviceDateFor(today: string, weekday: number, weeks: number): string {
  const todayWeekday = dayOfWeek(today);
  if (weeks > 0) {
    const daysAhead = (weekday - todayWeekday + 7) % 7 || 7;
    return addDays(today, daysAhead + (weeks - 1) * 7);
  }
  const daysBack = (todayWeekday - weekday + 7) % 7 || 7;
  return addDays(today, -(daysBack + (-weeks - 1) * 7));
}

export interface PlannedReservation {
  id: string;
  restaurant: string;
  table: string;
  customer: string;
  partySize: number;
  serviceDate: string;
  startMinutes: number;
  startsAt: Date;
  endsAt: Date;
  status: ReservationStatus;
  specialRequests: string | null;
  cancelledBy: CancelledBy | null;
  cancellationReason: string | null;
  cancelledAt: Date | null;
  createdAt: Date;
}

const HOUR_MS = 3_600_000;

/** Works out real dates for the demo bookings, relative to the moment the seed runs. */
export function planReservations(now: Date): PlannedReservation[] {
  const today = localDate(now, TIME_ZONE);

  return RESERVATIONS.map((booking) => {
    const restaurant = RESTAURANTS.find(({ slug }) => slug === booking.restaurant);
    if (!restaurant) throw new Error(`Unknown restaurant: ${booking.restaurant}`);

    const serviceDate = serviceDateFor(today, booking.weekday, booking.weeks);
    const startsAt = localTimeToUtc(serviceDate, booking.startMinutes, TIME_ZONE);
    // Plain addition is right here: a booking lasts a fixed length of time from a real moment.
    const endsAt = new Date(startsAt.getTime() + restaurant.reservationDurationMin * 60_000);
    // Past bookings were made three days ahead, and upcoming ones yesterday.
    const createdAt = new Date(
      booking.weeks < 0 ? startsAt.getTime() - 72 * HOUR_MS : now.getTime() - 24 * HOUR_MS,
    );

    return {
      id: booking.id,
      restaurant: booking.restaurant,
      table: booking.table,
      customer: booking.customer,
      partySize: booking.partySize,
      serviceDate,
      startMinutes: booking.startMinutes,
      startsAt,
      endsAt,
      status: booking.status,
      specialRequests: booking.specialRequests ?? null,
      cancelledBy: booking.cancellation?.by ?? null,
      cancellationReason: booking.cancellation?.reason ?? null,
      cancelledAt: booking.cancellation ? new Date(createdAt.getTime() + 6 * HOUR_MS) : null,
      createdAt,
    };
  });
}
