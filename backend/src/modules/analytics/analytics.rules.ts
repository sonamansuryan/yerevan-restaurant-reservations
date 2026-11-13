// The counting behind Seghan's analytics (PROJECT_PLAN.md 9.6), as pure functions: which days are
// counted, and what their bookings add up to. analytics.service.ts reads the bookings; everything
// here can be tested without a database.
import type { ReservationStatus } from "../../generated/prisma/enums.ts";
import { addDays, localDate, localDayRange } from "../../lib/time.ts";

/** How many days the numbers cover: about a week, a month or a season. */
export type AnalyticsDays = 7 | 30 | 90;

export interface AnalyticsPeriod {
  days: AnalyticsDays;
  /** The first and last days counted, as YYYY-MM-DD on the calendar given. The last is today. */
  from: string;
  to: string;
  /** The same days as moments: from the first one's midnight to the midnight after the last. */
  start: Date;
  end: Date;
}

/**
 * The days counted: today and the days before it, `days` in all, on the calendar of `timeZone`.
 * A booking belongs to the day it starts on, as in the dashboard's day view, so these are whole
 * days, and today's later bookings count as well.
 */
export function analyticsPeriod(days: AnalyticsDays, now: Date, timeZone: string): AnalyticsPeriod {
  const to = localDate(now, timeZone);
  const from = addDays(to, 1 - days);
  return {
    days,
    from,
    to,
    start: localDayRange(from, timeZone).start,
    end: localDayRange(to, timeZone).end,
  };
}

/** What the counting needs of one booking. */
export interface CountedBooking {
  status: ReservationStatus;
  partySize: number;
  /** Its review's rating, 1 to 5, or null when it has none. */
  rating: number | null;
}

export interface AnalyticsNumbers {
  /** Every booking for those days, whatever became of it. */
  bookings: number;
  /** How many of them have each status. Every status is listed, with 0 when there are none. */
  statuses: Record<ReservationStatus, number>;
  /** The people in the bookings marked arrived: the guests who came. */
  guests: number;
  /** The reviews of those bookings. */
  ratings: {
    count: number;
    /** Their average, out of 5, or null when there are none. */
    average: number | null;
    /** How many gave each rating, from 5 down to 1. Every rating is listed. */
    byRating: { rating: number; count: number }[];
  };
}

const RATINGS = [5, 4, 3, 2, 1];

/** What a period's bookings add up to. */
export function countBookings(bookings: CountedBooking[]): AnalyticsNumbers {
  // Written out, so a new status in the schema can't be left uncounted: TypeScript asks for it.
  const statuses: Record<ReservationStatus, number> = {
    PENDING: 0,
    CONFIRMED: 0,
    ARRIVED: 0,
    NO_SHOW: 0,
    CANCELLED: 0,
  };
  let guests = 0;
  const ratings: number[] = [];

  for (const booking of bookings) {
    statuses[booking.status] += 1;
    // Only a party marked arrived came. No-shows and cancelled bookings didn't, and a pending or
    // confirmed one hasn't been marked yet, so none of those are counted as guests.
    if (booking.status === "ARRIVED") guests += booking.partySize;
    if (booking.rating !== null) ratings.push(booking.rating);
  }

  const total = ratings.reduce((sum, rating) => sum + rating, 0);
  return {
    bookings: bookings.length,
    statuses,
    guests,
    ratings: {
      count: ratings.length,
      // Left unrounded, as the restaurant's own average is: the page rounds it once, to show it.
      average: ratings.length > 0 ? total / ratings.length : null,
      byRating: RATINGS.map((rating) => ({
        rating,
        count: ratings.filter((one) => one === rating).length,
      })),
    },
  };
}

export interface RankedRestaurant {
  id: string;
  slug: string;
  name: string;
  bookings: number;
}

/**
 * The restaurants with the most bookings, the most first, at most `limit` of them. Equal ones go
 * by name, then by id, so the list is the same every time. A restaurant with none isn't listed.
 */
export function mostBooked(
  bookings: { restaurantId: string }[],
  restaurants: { id: string; slug: string; name: string }[],
  limit: number,
): RankedRestaurant[] {
  const counts = new Map<string, number>();
  for (const { restaurantId } of bookings) {
    counts.set(restaurantId, (counts.get(restaurantId) ?? 0) + 1);
  }
  return restaurants
    .map(({ id, slug, name }) => ({ id, slug, name, bookings: counts.get(id) ?? 0 }))
    .filter(({ bookings: count }) => count > 0)
    .sort(
      (a, b) =>
        b.bookings - a.bookings ||
        a.name.localeCompare(b.name, "en") ||
        // Ids are compared as plain text, which no language's rules can reorder.
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )
    .slice(0, limit);
}
