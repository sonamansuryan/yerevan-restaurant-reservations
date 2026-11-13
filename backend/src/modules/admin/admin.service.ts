// Seghan's admin (PROJECT_PLAN.md 9.5): lists of everyone's users, restaurants and bookings, and
// one change, hiding a restaurant from guests or showing it again. Everything else is read only,
// as the plan's default for the admin panel says (§8, question 2).
import { Prisma } from "../../generated/prisma/client.ts";
import type { District, ReservationStatus, Role } from "../../generated/prisma/enums.ts";
import { NotFoundError } from "../../lib/errors.ts";
import { logger } from "../../lib/logger.ts";
import { prisma } from "../../lib/prisma.ts";
import { SEGHAN_TIME_ZONE, localClockTime, localDate, localDayRange } from "../../lib/time.ts";
import type {
  AdminReservationListQuery,
  AdminRestaurantListQuery,
  AdminUserListQuery,
} from "./admin.schemas.ts";

interface Page<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number };
}

const REPEATABLE_READ = { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead };
const contains = (text: string) => ({ contains: text, mode: "insensitive" as const });

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
  /** Restaurants they own, and bookings they made. */
  restaurants: number;
  reservations: number;
}

/** Everyone with an account, the newest first, by name or email and by role. */
export async function listUsers({
  q,
  role,
  page,
  pageSize,
}: AdminUserListQuery): Promise<Page<AdminUser>> {
  const where = {
    ...(role ? { role } : {}),
    ...(q ? { OR: [{ name: contains(q) }, { email: contains(q) }] } : {}),
  } satisfies Prisma.UserWhereInput;
  // The page and the total come from the same moment.
  const [rows, total] = await prisma.$transaction(
    [
      prisma.user.findMany({
        where,
        // Never the password hash, the Google id or anything about their sessions.
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          _count: { select: { restaurants: true, reservations: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ],
    REPEATABLE_READ,
  );
  return {
    data: rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      createdAt: row.createdAt.toISOString(),
      restaurants: row._count.restaurants,
      reservations: row._count.reservations,
    })),
    meta: { page, pageSize, total },
  };
}

export interface AdminRestaurant {
  id: string;
  slug: string;
  name: string;
  district: District;
  owner: { name: string; email: string };
  /** The owner's own choice. */
  isPublished: boolean;
  /** When Seghan hid it from guests, or null. A hidden restaurant stays hidden whatever the owner chooses. */
  hiddenAt: string | null;
  /** A real restaurant listed from public data for the demo (9.7), which can't be booked. */
  isDemoListing: boolean;
  reservations: number;
  createdAt: string;
}

const adminRestaurantFields = {
  id: true,
  slug: true,
  name: true,
  district: true,
  isPublished: true,
  hiddenAt: true,
  isDemoListing: true,
  createdAt: true,
  owner: { select: { name: true, email: true } },
  _count: { select: { reservations: true } },
} satisfies Prisma.RestaurantSelect;

type AdminRestaurantRow = Prisma.RestaurantGetPayload<{ select: typeof adminRestaurantFields }>;

function toAdminRestaurant(row: AdminRestaurantRow): AdminRestaurant {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    district: row.district,
    owner: row.owner,
    isPublished: row.isPublished,
    hiddenAt: row.hiddenAt?.toISOString() ?? null,
    isDemoListing: row.isDemoListing,
    reservations: row._count.reservations,
    createdAt: row.createdAt.toISOString(),
  };
}

const RESTAURANT_STATES = {
  published: { isPublished: true, hiddenAt: null },
  draft: { isPublished: false, hiddenAt: null },
  hidden: { hiddenAt: { not: null } },
} satisfies Record<string, Prisma.RestaurantWhereInput>;

/** Every restaurant, drafts and hidden ones included, by name. */
export async function listRestaurantsForAdmin({
  q,
  show,
  page,
  pageSize,
}: AdminRestaurantListQuery): Promise<Page<AdminRestaurant>> {
  const where = {
    ...(show ? RESTAURANT_STATES[show] : {}),
    ...(q ? { OR: [{ name: contains(q) }, { address: contains(q) }] } : {}),
  } satisfies Prisma.RestaurantWhereInput;
  const [rows, total] = await prisma.$transaction(
    [
      prisma.restaurant.findMany({
        where,
        select: adminRestaurantFields,
        // The id breaks ties between equal names, so no restaurant shows on two pages.
        orderBy: [{ name: "asc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.restaurant.count({ where }),
    ],
    REPEATABLE_READ,
  );
  return { data: rows.map(toAdminRestaurant), meta: { page, pageSize, total } };
}

/**
 * Seghan hides a restaurant from guests, or shows it again. Hidden, nobody can find, book or save
 * it, whatever its owner chooses, and the owner's dashboard says so. Its bookings stay as they are:
 * the guests and the restaurant still see and manage them. Hiding one already hidden keeps the
 * moment it was first hidden.
 */
export async function setRestaurantHidden(
  adminId: string,
  restaurantId: string,
  hidden: boolean,
  now: Date = new Date(),
): Promise<AdminRestaurant> {
  // Only the hidden moment changes, never what the owner chose, so the two can't overwrite each other.
  const { count } = hidden
    ? await prisma.restaurant.updateMany({
        where: { id: restaurantId, hiddenAt: null },
        data: { hiddenAt: now },
      })
    : await prisma.restaurant.updateMany({
        where: { id: restaurantId, hiddenAt: { not: null } },
        data: { hiddenAt: null },
      });

  const row = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: adminRestaurantFields,
  });
  if (!row) throw new NotFoundError("RESTAURANT_NOT_FOUND");
  // Who changed what, for the record. Names and emails stay out of the log.
  if (count > 0) logger.info({ restaurantId, hidden, adminId }, "Restaurant visibility changed");
  return toAdminRestaurant(row);
}

export interface AdminReservation {
  id: string;
  status: ReservationStatus;
  partySize: number;
  /** The day it's for, on the restaurant's calendar, and its times on the restaurant's clock. */
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

/** Every booking, the latest start first, by restaurant or guest, status and day. */
export async function listReservationsForAdmin({
  q,
  status,
  date,
  page,
  pageSize,
}: AdminReservationListQuery): Promise<Page<AdminReservation>> {
  const day = date ? localDayRange(date, SEGHAN_TIME_ZONE) : null;
  const where = {
    ...(status ? { status } : {}),
    ...(day ? { startsAt: { gte: day.start, lt: day.end } } : {}),
    ...(q
      ? {
          OR: [
            { restaurant: { name: contains(q) } },
            { user: { name: contains(q) } },
            { user: { email: contains(q) } },
          ],
        }
      : {}),
  } satisfies Prisma.ReservationWhereInput;
  const [rows, total] = await prisma.$transaction(
    [
      prisma.reservation.findMany({
        where,
        select: {
          id: true,
          status: true,
          partySize: true,
          startsAt: true,
          endsAt: true,
          createdAt: true,
          restaurant: { select: { id: true, slug: true, name: true, timezone: true } },
          table: { select: { label: true } },
          user: { select: { name: true, email: true } },
        },
        orderBy: [{ startsAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.reservation.count({ where }),
    ],
    REPEATABLE_READ,
  );
  return {
    data: rows.map((row) => {
      const timeZone = row.restaurant.timezone;
      return {
        id: row.id,
        status: row.status,
        partySize: row.partySize,
        date: localDate(row.startsAt, timeZone),
        starts: localClockTime(row.startsAt, timeZone),
        ends: localClockTime(row.endsAt, timeZone),
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
        restaurant: { id: row.restaurant.id, slug: row.restaurant.slug, name: row.restaurant.name },
        table: row.table,
        guest: row.user,
        createdAt: row.createdAt.toISOString(),
      };
    }),
    meta: { page, pageSize, total },
  };
}
