import type { Bar } from "@/components/BarList";
import type { Figure } from "@/components/Figures";
import { RESERVATION_STATUSES } from "@/features/admin/admin";
import { STATUS_LABELS } from "@/features/dashboard/labels";
import { averageWords, ratingWords } from "@/features/reviews/reviews";
import type { Analytics, AnalyticsDays } from "@/types/api";

// Seghan's analytics (9.6): a restaurant's numbers on its dashboard, and all of Seghan's in the
// admin area, for the last 7, 30 or 90 days. The period lives in the address, ?days=7, so Back and
// shared links work, as the other filters do. The server counts; this only puts it into words.

/** The periods offered, the shortest first. */
export const ANALYTICS_DAYS: readonly AnalyticsDays[] = [7, 30, 90];

/** The period shown when the address names none, as the API counts without ?days=. */
export const DEFAULT_DAYS: AnalyticsDays = 30;

/** The Period choice, as its list shows it. */
export const PERIOD_CHOICES: Record<AnalyticsDays, string> = {
  7: "The last 7 days",
  30: "The last 30 days",
  90: "The last 90 days",
};

/** The period in the address, or the usual 30 days when it's missing or isn't one offered. */
export function readDays(params: URLSearchParams): AnalyticsDays {
  const text = params.get("days");
  return ANALYTICS_DAYS.find((days) => String(days) === text) ?? DEFAULT_DAYS;
}

/** The address's query for a period, leaving out the usual 30 days. */
export function daysToParams(days: AnalyticsDays): URLSearchParams {
  return new URLSearchParams(days === DEFAULT_DAYS ? {} : { days: String(days) });
}

const count = new Intl.NumberFormat("en-GB");

/**
 * A part of a whole, to the nearest whole percent: "12%". A rounded 0% would say there were none,
 * and 100% that it was all of them, so those read "<1%" and ">99%" when they aren't true.
 */
export function shareWords(part: number, whole: number): string {
  if (whole <= 0) return "0%";
  const percent = (part / whole) * 100;
  if (part > 0 && percent < 1) return "<1%";
  if (part < whole && percent > 99) return ">99%";
  return `${Math.round(percent)}%`;
}

/** "1 review", "23 reviews". */
export function reviewsWords(total: number): string {
  return total === 1 ? "1 review" : `${count.format(total)} reviews`;
}

/** The headline numbers: bookings, guests, cancellations, no-shows and the rating. */
export function analyticsFigures({ bookings, statuses, guests, ratings }: Analytics): Figure[] {
  return [
    { label: "Bookings", value: count.format(bookings) },
    { label: "Guests", value: count.format(guests), note: "who came" },
    {
      label: "Cancellations",
      value: count.format(statuses.CANCELLED),
      note: `${shareWords(statuses.CANCELLED, bookings)} of bookings`,
    },
    {
      label: "No-shows",
      value: count.format(statuses.NO_SHOW),
      note: `${shareWords(statuses.NO_SHOW, bookings)} of bookings`,
    },
    ratings.average === null
      ? { label: "Rating", value: "–", spoken: "None", note: "No reviews yet" }
      : {
          label: "Rating",
          value: averageWords(ratings.average),
          note: `out of 5, from ${reviewsWords(ratings.count)}`,
        },
  ];
}

/** Every status, in the order a booking moves through them, each as its share of the bookings. */
export function statusBars({ bookings, statuses }: Analytics): Bar[] {
  return RESERVATION_STATUSES.map((status) => ({
    key: status,
    label: STATUS_LABELS[status],
    value: statuses[status],
    note: shareWords(statuses[status], bookings),
  }));
}

/** Each rating, from 5 down to 1, as its share of the reviews. */
export function ratingBars({ ratings }: Analytics): Bar[] {
  return ratings.byRating.map(({ rating, count: reviews }) => ({
    key: String(rating),
    label: ratingWords(rating),
    value: reviews,
    note: shareWords(reviews, ratings.count),
  }));
}
