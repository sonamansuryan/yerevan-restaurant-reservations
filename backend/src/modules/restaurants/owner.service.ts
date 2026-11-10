// The owner's side of restaurants. Every query that reads or changes a restaurant includes its
// owner, so one that exists but belongs to someone else looks exactly like one that doesn't exist.
// Two queries don't need it: the address check looks across all restaurants, because addresses are
// unique on Seghan, and the counts before publishing use the id that requireRestaurantOwner checked.
import type { Prisma } from "../../generated/prisma/client.ts";
import type { Cuisine, District } from "../../generated/prisma/enums.ts";
import { isRecordMissing, isUniqueViolation } from "../../lib/db-errors.ts";
import { ConflictError, NotFoundError } from "../../lib/errors.ts";
import { prisma } from "../../lib/prisma.ts";
import { freeSlug, notReadyMessage, publishBlockers, slugFromName } from "./owner.rules.ts";
import type { CreateRestaurantInput, UpdateRestaurantInput } from "./restaurants.schemas.ts";

/** A restaurant as its owner sees it in the dashboard, unpublished or not. */
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
  priceLevel: number;
  /** Minutes between the start times guests can choose. */
  slotIntervalMin: number;
  /** How long one booking holds its table, in minutes. */
  reservationDurationMin: number;
  isPublished: boolean;
}

// Only what the owner's view shows: never the owner's id or the Google place id.
const ownerFields = {
  id: true,
  slug: true,
  name: true,
  description: true,
  cuisines: true,
  district: true,
  address: true,
  phone: true,
  website: true,
  priceLevel: true,
  slotIntervalMin: true,
  reservationDurationMin: true,
  isPublished: true,
} satisfies Prisma.RestaurantSelect;

type OwnerRow = Prisma.RestaurantGetPayload<{ select: typeof ownerFields }>;

/**
 * Whether this restaurant is this owner's. The owner is part of the query itself, rather than
 * compared after the restaurant is found, so there's no comparison for any code to forget.
 */
export async function ownsRestaurant(ownerId: string, restaurantId: string): Promise<boolean> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId, ownerId },
    select: { id: true },
  });
  return restaurant !== null;
}

/** One of this owner's restaurants, as the dashboard shows it. */
export async function getOwnedRestaurant(
  ownerId: string,
  restaurantId: string,
): Promise<OwnerRestaurant> {
  // requireRestaurantOwner has already checked, but every owner query includes the owner anyway,
  // so this one stays safe even if a route ever forgets the check.
  const row = await prisma.restaurant.findUnique({
    where: { id: restaurantId, ownerId },
    select: ownerFields,
  });
  if (!row) throw new NotFoundError("RESTAURANT_NOT_FOUND");
  return toOwnerRestaurant(row);
}

/** How many times a new restaurant tries for a free address before giving up (a 500). */
const SLUG_ATTEMPTS = 3;

/**
 * A new restaurant for this owner. It starts unpublished, at an address made from its name, which
 * never changes afterwards, so links to it keep working.
 */
export async function createRestaurant(
  ownerId: string,
  input: CreateRestaurantInput,
): Promise<OwnerRestaurant> {
  const base = slugFromName(input.name);
  for (let attempt = 1; ; attempt++) {
    const taken = await prisma.restaurant.findMany({
      where: { slug: { startsWith: base } },
      select: { slug: true },
    });
    const slug = freeSlug(
      base,
      taken.map((row) => row.slug),
    );
    try {
      const row = await prisma.restaurant.create({
        data: { ...input, ownerId, slug },
        select: ownerFields,
      });
      return toOwnerRestaurant(row);
    } catch (error) {
      // Two owners can pick the same free address at the same moment. The database's unique slug
      // refuses one of them, which looks again and takes the next free one.
      if (!isUniqueViolation(error) || attempt === SLUG_ATTEMPTS) throw error;
    }
  }
}

/**
 * Changes one of this owner's restaurants, saving only the details sent. Publishing needs at least
 * one active table and opening hours, or nothing is saved (409). Unpublishing is always allowed.
 */
export async function updateRestaurant(
  ownerId: string,
  restaurantId: string,
  changes: UpdateRestaurantInput,
): Promise<OwnerRestaurant> {
  if (changes.isPublished === true) {
    const [activeTables, openingHours] = await Promise.all([
      prisma.table.count({ where: { restaurantId, isActive: true } }),
      prisma.openingHour.count({ where: { restaurantId } }),
    ]);
    const missing = publishBlockers({ activeTables, openingHours });
    if (missing.length > 0) {
      throw new ConflictError("NOT_READY_TO_PUBLISH", notReadyMessage(missing), { missing });
    }
  }

  try {
    const row = await prisma.restaurant.update({
      where: { id: restaurantId, ownerId },
      data: changes,
      select: ownerFields,
    });
    return toOwnerRestaurant(row);
  } catch (error) {
    if (isRecordMissing(error)) throw new NotFoundError("RESTAURANT_NOT_FOUND");
    throw error;
  }
}

export function toOwnerRestaurant(row: OwnerRow): OwnerRestaurant {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    cuisines: row.cuisines,
    district: row.district,
    address: row.address,
    phone: row.phone,
    website: row.website,
    priceLevel: row.priceLevel,
    slotIntervalMin: row.slotIntervalMin,
    reservationDurationMin: row.reservationDurationMin,
    isPublished: row.isPublished,
  };
}
