// The numbers behind Seghan's analytics (PROJECT_PLAN.md 9.6): one restaurant's, on its owner's
// dashboard, and all of Seghan's, in the admin area. Each reads the bookings for the days asked
// for, at one moment, and analytics.rules.ts counts them. Nothing here changes anything.
import { Prisma } from "../../generated/prisma/client.ts";
import { NotFoundError } from "../../lib/errors.ts";
import { prisma } from "../../lib/prisma.ts";
import { SEGHAN_TIME_ZONE } from "../../lib/time.ts";
import { analyticsPeriod, countBookings, mostBooked } from "./analytics.rules.ts";
import type {
  AnalyticsDays,
  AnalyticsNumbers,
  AnalyticsPeriod,
  RankedRestaurant,
} from "./analytics.rules.ts";
import type { AnalyticsQuery } from "./analytics.schemas.ts";

/** How many restaurants the admin's Most booked lists. */
export const MOST_BOOKED_LIMIT = 10;

export interface Analytics extends AnalyticsNumbers {
  /** The days counted, as YYYY-MM-DD: today and the days before it, on the restaurant's calendar. */
  period: { days: AnalyticsDays; from: string; to: string };
}

export interface SeghanAnalytics extends Analytics {
  /** The restaurants with the most bookings for those days, the most first. */
  restaurants: RankedRestaurant[];
}

// The bookings and their reviews come from two statements, so they're read in one transaction at
// REPEATABLE READ, which sees the database as it was at one moment.
const REPEATABLE_READ = { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead };

// What the counting needs of each booking: three small columns. Seghan counts them in code, where
// the rules are plain and unit-tested; reading 90 days of every restaurant's bookings this way is
// quick at Seghan's size. A far bigger Seghan would count in the database instead (groupBy).
const countedFields = {
  status: true,
  partySize: true,
  review: { select: { rating: true } },
} satisfies Prisma.ReservationSelect;

type CountedRow = Prisma.ReservationGetPayload<{ select: typeof countedFields }>;

const toCounted = ({ status, partySize, review }: CountedRow) => ({
  status,
  partySize,
  rating: review?.rating ?? null,
});

const shown = ({ days, from, to }: AnalyticsPeriod): Analytics["period"] => ({ days, from, to });

/** One of the owner's restaurants: its bookings for the days asked for, on its own calendar. */
export async function restaurantAnalytics(
  ownerId: string,
  restaurantId: string,
  { days }: AnalyticsQuery,
  now: Date = new Date(),
): Promise<Analytics> {
  // The owner again, as in every owner query, even though requireRestaurantOwner has checked.
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId, ownerId },
    select: { timezone: true },
  });
  if (!restaurant) throw new NotFoundError("RESTAURANT_NOT_FOUND");

  const period = analyticsPeriod(days, now, restaurant.timezone);
  const rows = await prisma.$transaction(
    (tx) =>
      tx.reservation.findMany({
        where: { restaurantId, startsAt: { gte: period.start, lt: period.end } },
        select: countedFields,
      }),
    REPEATABLE_READ,
  );
  return { period: shown(period), ...countBookings(rows.map(toCounted)) };
}

/**
 * Every restaurant on Seghan, drafts and hidden ones included: all their bookings for the days
 * asked for, on Yerevan's calendar, and the restaurants with the most.
 */
export async function seghanAnalytics(
  { days }: AnalyticsQuery,
  now: Date = new Date(),
): Promise<SeghanAnalytics> {
  const period = analyticsPeriod(days, now, SEGHAN_TIME_ZONE);
  const { rows, restaurants } = await prisma.$transaction(async (tx) => {
    const bookings = await tx.reservation.findMany({
      where: { startsAt: { gte: period.start, lt: period.end } },
      select: { ...countedFields, restaurantId: true },
    });
    // Only the restaurants those bookings are at, and only what the list shows of them.
    const booked = await tx.restaurant.findMany({
      where: { id: { in: [...new Set(bookings.map(({ restaurantId }) => restaurantId))] } },
      select: { id: true, slug: true, name: true },
    });
    return { rows: bookings, restaurants: booked };
  }, REPEATABLE_READ);

  return {
    period: shown(period),
    ...countBookings(rows.map(toCounted)),
    restaurants: mostBooked(rows, restaurants, MOST_BOOKED_LIMIT),
  };
}
