// The map on a restaurant's page (PROJECT_PLAN.md 9.4). Geoapify finds the address once, then
// draws its street whenever a browser asks, which browsers keep for a day. Where each address is
// is remembered here, so it isn't looked up again for every visitor: a place found for 30 days, an
// address Geoapify doesn't know for a day, and a failure for 5 minutes, so a struggling Geoapify
// isn't asked again at once.
import { findAddress, mapsEnabled, streetMap } from "../../integrations/geoapify/maps.ts";
import type { MapPoint } from "../../integrations/geoapify/maps.ts";
import { NotFoundError, ServiceUnavailableError } from "../../lib/errors.ts";
import { logger } from "../../lib/logger.ts";
import { prisma } from "../../lib/prisma.ts";
import { PUBLISHED } from "./restaurants.service.ts";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
export const REMEMBER_FOUND_MS = 30 * DAY;
export const REMEMBER_NOT_FOUND_MS = DAY;
export const REMEMBER_FAILURE_MS = 5 * MINUTE;
/** At most this many addresses are remembered. The one remembered longest ago goes first. */
export const MAX_REMEMBERED = 500;

interface Remembered {
  point: Promise<MapPoint | null>;
  /** Until when the answer stands. While the question is still out, for ever. */
  until: number;
}

const places = new Map<string, Remembered>();

/** Forgets every address. For tests. */
export function forgetPlaces(): void {
  places.clear();
}

/** Where an address is, asked of Geoapify only when it isn't remembered, and only once at a time. */
function pointFor(address: string, now: number): Promise<MapPoint | null> {
  const known = places.get(address);
  if (known && known.until > now) return known.point;

  const point = findAddress(address);
  const remembered: Remembered = { point, until: Number.POSITIVE_INFINITY };
  places.delete(address);
  places.set(address, remembered);
  if (places.size > MAX_REMEMBERED) {
    const oldest = places.keys().next().value;
    if (oldest !== undefined) places.delete(oldest);
  }
  point.then(
    (found) => {
      remembered.until = now + (found ? REMEMBER_FOUND_MS : REMEMBER_NOT_FOUND_MS);
    },
    () => {
      remembered.until = now + REMEMBER_FAILURE_MS;
    },
  );
  return point;
}

/**
 * The picture of a published restaurant's street, as a PNG. Without a Maps key, or for an address
 * Geoapify can't find, there's no map (404). When Geoapify can't be reached or refuses, it's 503,
 * logged by type and code only. Either way the page shows the address and its link instead.
 */
export async function restaurantMap(slug: string, now: number = Date.now()): Promise<Uint8Array> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug, ...PUBLISHED },
    select: { address: true },
  });
  if (!restaurant) throw new NotFoundError("RESTAURANT_NOT_FOUND");
  if (!mapsEnabled()) throw new NotFoundError("MAP_NOT_FOUND");

  let point: MapPoint | null;
  try {
    point = await pointFor(restaurant.address, now);
  } catch (err) {
    logger.warn({ err, slug }, "Map address not found: Geoapify unavailable");
    throw new ServiceUnavailableError("MAP_UNAVAILABLE");
  }
  if (!point) throw new NotFoundError("MAP_NOT_FOUND");

  try {
    return await streetMap(point);
  } catch (err) {
    logger.warn({ err, slug }, "Map not drawn: Geoapify unavailable");
    throw new ServiceUnavailableError("MAP_UNAVAILABLE");
  }
}
