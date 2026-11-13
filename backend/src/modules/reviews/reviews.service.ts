// Reviews: a guest reviews one of their visits, and anyone reads a published restaurant's reviews.
import { Prisma } from "../../generated/prisma/client.ts";
import { isUniqueViolation } from "../../lib/db-errors.ts";
import { ConflictError, NotFoundError } from "../../lib/errors.ts";
import { prisma } from "../../lib/prisma.ts";
import { localDate } from "../../lib/time.ts";
import { PUBLISHED } from "../restaurants/restaurants.service.ts";
import type { CreateReviewInput, ReviewListQuery } from "./reviews.schemas.ts";

/** A review as the guest who wrote it sees it, once posted. */
export interface GuestReview {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

/** A review as anyone sees it on the restaurant's page: with the guest's first name only. */
export interface PublicReview {
  id: string;
  rating: number;
  comment: string | null;
  author: string;
  /** The day it was written, in the restaurant's time zone (YYYY-MM-DD). */
  date: string;
  createdAt: string;
}

export interface ReviewList {
  data: PublicReview[];
  meta: { page: number; pageSize: number; total: number };
}

/**
 * Locks a restaurant's row while its rating changes. FOR NO KEY UPDATE makes other reviews of it
 * wait, but not bookings, which take only FOR KEY SHARE on that row (PROJECT_PLAN.md §5.4). It
 * never waits for a table's row, so it keeps the lock order.
 */
export async function lockRestaurantRating(
  tx: Prisma.TransactionClient,
  restaurantId: string,
): Promise<void> {
  await tx.$queryRaw`SELECT 1 FROM "Restaurant" WHERE "id" = ${restaurantId} FOR NO KEY UPDATE`;
}

/**
 * Posts the signed-in guest's review of one of their visits (PROJECT_PLAN.md 9.1). Only a visit
 * the restaurant marked arrived can be reviewed, and only once. The restaurant's average and count
 * change in the same transaction.
 *
 * The restaurant's row is locked first, so reviews of one restaurant take turns, and each average
 * counts every review saved before it. Two reviews of the same visit at once can't both be saved:
 * the database keeps one review per booking.
 */
export async function createReview(
  userId: string,
  reservationId: string,
  { rating, comment }: CreateReviewInput,
): Promise<GuestReview> {
  try {
    return await prisma.$transaction(async (tx) => {
      // Someone else's booking isn't found. Arrived is final, so it can't change in between.
      const booking = await tx.reservation.findUnique({
        where: { id: reservationId, userId },
        select: { status: true, restaurantId: true },
      });
      if (!booking) throw new NotFoundError("RESERVATION_NOT_FOUND");
      if (booking.status !== "ARRIVED") throw new ConflictError("NOT_VISITED");

      const { restaurantId } = booking;
      await lockRestaurantRating(tx, restaurantId);
      const review = await tx.review.create({
        data: { reservationId, restaurantId, userId, rating, comment: comment ?? null },
        select: { id: true, rating: true, comment: true, createdAt: true },
      });
      const { _avg, _count } = await tx.review.aggregate({
        where: { restaurantId },
        _avg: { rating: true },
        _count: { _all: true },
      });
      await tx.restaurant.update({
        where: { id: restaurantId },
        data: { avgRating: _avg.rating ?? 0, reviewCount: _count._all },
      });
      return { ...review, createdAt: review.createdAt.toISOString() };
    });
  } catch (error) {
    // The booking has its review already: one per visit.
    if (isUniqueViolation(error)) throw new ConflictError("ALREADY_REVIEWED");
    throw error;
  }
}

/** The first word of a name: all a stranger sees of who wrote a review. */
const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

/** One page of a published restaurant's reviews, newest first. Any other restaurant is a 404. */
export async function listReviews(
  slug: string,
  { page, pageSize }: ReviewListQuery,
): Promise<ReviewList> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug, ...PUBLISHED },
    select: { id: true, timezone: true },
  });
  if (!restaurant) throw new NotFoundError("RESTAURANT_NOT_FOUND");

  const where = { restaurantId: restaurant.id } satisfies Prisma.ReviewWhereInput;
  // Both reads in one transaction at REPEATABLE READ, so the page and the total agree.
  const [rows, total] = await prisma.$transaction(
    [
      prisma.review.findMany({
        where,
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          user: { select: { name: true } },
        },
        // The id breaks ties, so no review shows on two pages.
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.review.count({ where }),
    ],
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );

  return {
    data: rows.map((row) => ({
      id: row.id,
      rating: row.rating,
      comment: row.comment,
      author: firstName(row.user.name),
      date: localDate(row.createdAt, restaurant.timezone),
      createdAt: row.createdAt.toISOString(),
    })),
    meta: { page, pageSize, total },
  };
}
