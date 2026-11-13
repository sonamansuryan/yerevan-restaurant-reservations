// Favorites: the restaurants a guest saves to come back to (PROJECT_PLAN.md 9.2). Saving and
// unsaving can be repeated safely, so a double click or two tabs never turn into an error.
import { Prisma } from "../../generated/prisma/client.ts";
import { NotFoundError } from "../../lib/errors.ts";
import { prisma } from "../../lib/prisma.ts";
import { PUBLISHED, summaryFields, toSummary } from "../restaurants/restaurants.service.ts";
import type { RestaurantList } from "../restaurants/restaurants.service.ts";
import type { FavoriteListQuery } from "./favorites.schemas.ts";

/** Whether a restaurant is in the guest's favorites. Every favorites endpoint answers with it. */
export interface FavoriteState {
  saved: boolean;
}

/**
 * One page of the guest's favorites, the last saved first, as cards like Browse's. A restaurant
 * that's no longer published stays saved, but isn't shown or counted while it's hidden.
 */
export async function listFavorites(
  userId: string,
  { page, pageSize }: FavoriteListQuery,
): Promise<RestaurantList> {
  const where = { userId, restaurant: PUBLISHED } satisfies Prisma.FavoriteWhereInput;
  // Both reads in one transaction at REPEATABLE READ, so the page and the total agree.
  const [rows, total] = await prisma.$transaction(
    [
      prisma.favorite.findMany({
        where,
        select: { restaurant: { select: summaryFields } },
        // The restaurant breaks ties, so no favorite shows on two pages.
        orderBy: [{ createdAt: "desc" }, { restaurantId: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.favorite.count({ where }),
    ],
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
  return { data: rows.map((row) => toSummary(row.restaurant)), meta: { page, pageSize, total } };
}

/** Whether the guest saved this published restaurant. Any other address is simply not saved. */
export async function getFavorite(userId: string, slug: string): Promise<FavoriteState> {
  const row = await prisma.favorite.findFirst({
    where: { userId, restaurant: { slug, ...PUBLISHED } },
    select: { createdAt: true },
  });
  return { saved: row !== null };
}

/** Saves a published restaurant. Saving it again, even at the same moment, changes nothing. */
export async function saveFavorite(userId: string, slug: string): Promise<FavoriteState> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug, ...PUBLISHED },
    select: { id: true },
  });
  if (!restaurant) throw new NotFoundError("RESTAURANT_NOT_FOUND");

  // The pair is the table's key. ON CONFLICT DO NOTHING skips a second copy inside the database,
  // so two saves that cross can't fail on each other.
  await prisma.favorite.createMany({
    data: [{ userId, restaurantId: restaurant.id }],
    skipDuplicates: true,
  });
  return { saved: true };
}

/** Takes a restaurant out of the guest's favorites. One that isn't there is already out. */
export async function removeFavorite(userId: string, slug: string): Promise<FavoriteState> {
  await prisma.favorite.deleteMany({ where: { userId, restaurant: { slug } } });
  return { saved: false };
}
