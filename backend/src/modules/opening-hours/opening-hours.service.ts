import { NotFoundError } from "../../lib/errors.ts";
import { prisma } from "../../lib/prisma.ts";
import { minutesToTime } from "../../lib/time.ts";
import { lockOwnedRestaurant } from "../restaurants/owner.service.ts";
import type { OpeningHours } from "../restaurants/restaurants.service.ts";
import type { Opening } from "./opening-hours.rules.ts";

/**
 * One restaurant's week as saved, in the same order and shape a save answers with. The restaurant
 * is the one requireRestaurantOwner checked, so its id is enough here.
 */
export async function getWeek(restaurantId: string): Promise<OpeningHours[]> {
  const rows = await prisma.openingHour.findMany({
    where: { restaurantId },
    orderBy: [{ dayOfWeek: "asc" }, { opensAt: "asc" }],
    select: { dayOfWeek: true, opensAt: true, closesAt: true },
  });
  return rows.map(toOpeningHours);
}

/**
 * Replaces the week of opening hours of one of this owner's restaurants, in one transaction:
 * either the whole new week is saved, or the old one stays exactly as it was. The week has
 * already been checked, overlaps included.
 */
export async function replaceWeek(
  ownerId: string,
  restaurantId: string,
  week: readonly Opening[],
): Promise<OpeningHours[]> {
  const rows = await prisma.$transaction(async (tx) => {
    // Two saves of the same week take turns. Without the lock, both could delete the old week and
    // both insert theirs, leaving a mix of the two that overlaps.
    if (!(await lockOwnedRestaurant(tx, ownerId, restaurantId))) {
      throw new NotFoundError("RESTAURANT_NOT_FOUND");
    }
    await tx.openingHour.deleteMany({ where: { restaurantId } });
    await tx.openingHour.createMany({
      data: week.map(({ dayOfWeek, opensAt, closesAt }) => ({
        restaurantId,
        dayOfWeek,
        opensAt,
        closesAt,
      })),
    });
    return tx.openingHour.findMany({
      where: { restaurantId },
      orderBy: [{ dayOfWeek: "asc" }, { opensAt: "asc" }],
      select: { dayOfWeek: true, opensAt: true, closesAt: true },
    });
  });
  return rows.map(toOpeningHours);
}

/** An opening as replies show it, with its times ready to read: 1560 is "02:00". */
export function toOpeningHours({ dayOfWeek, opensAt, closesAt }: Opening): OpeningHours {
  return {
    dayOfWeek,
    opensAt,
    closesAt,
    opens: minutesToTime(opensAt),
    closes: minutesToTime(closesAt),
  };
}
