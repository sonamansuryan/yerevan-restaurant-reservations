// The map on a restaurant's page (src/modules/restaurants/restaurant-map.service.ts), with Prisma and
// Geoapify replaced: only published restaurants, no map without a key, each address looked up once
// and remembered for as long as its answer stands, and Geoapify failing as a 503, never a crash.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { findAddress, mapsEnabled, streetMap } from "../src/integrations/geoapify/maps.ts";
import { MapUnavailableError } from "../src/integrations/geoapify/maps.ts";
import { prisma } from "../src/lib/prisma.ts";
import {
  REMEMBER_FAILURE_MS,
  REMEMBER_FOUND_MS,
  REMEMBER_NOT_FOUND_MS,
  forgetPlaces,
  restaurantMap,
} from "../src/modules/restaurants/restaurant-map.service.ts";

vi.mock("../src/lib/prisma.ts", () => ({
  prisma: { restaurant: { findUnique: vi.fn() } },
  isDatabaseReachable: vi.fn(),
}));

const findRestaurant = vi.mocked(prisma.restaurant.findUnique);
const lookUp = vi.mocked(findAddress);
const draw = vi.mocked(streetMap);
const PNG = new Uint8Array([137, 80, 78, 71]);
const LORI = { lat: 40.1976, lon: 44.5011 };
const NOW = Date.parse("2026-11-12T10:00:00.000Z");

beforeEach(() => {
  findRestaurant.mockResolvedValue({ address: "52 Komitas Avenue, Yerevan" } as never);
  lookUp.mockResolvedValue(LORI);
  draw.mockResolvedValue(PNG);
});

afterEach(() => {
  forgetPlaces();
  vi.clearAllMocks();
});

test("draws a published restaurant's street, found from its address", async () => {
  expect(await restaurantMap("lori-smokehouse", NOW)).toBe(PNG);

  expect(findRestaurant).toHaveBeenCalledWith({
    where: { slug: "lori-smokehouse", isPublished: true, hiddenAt: null },
    select: { address: true },
  });
  expect(lookUp).toHaveBeenCalledWith("52 Komitas Avenue, Yerevan");
  expect(draw).toHaveBeenCalledWith(LORI);
});

test("a restaurant that doesn't exist, or isn't published, is a 404, and Geoapify isn't asked", async () => {
  findRestaurant.mockResolvedValue(null);

  await expect(restaurantMap("davtashen-test-kitchen", NOW)).rejects.toMatchObject({
    statusCode: 404,
    code: "RESTAURANT_NOT_FOUND",
  });
  expect(lookUp).not.toHaveBeenCalled();
});

test("without a Maps key there's no map, and Geoapify isn't asked", async () => {
  vi.mocked(mapsEnabled).mockReturnValueOnce(false);

  await expect(restaurantMap("lori-smokehouse", NOW)).rejects.toMatchObject({
    statusCode: 404,
    code: "MAP_NOT_FOUND",
  });
  expect(lookUp).not.toHaveBeenCalled();
});

describe("each address is looked up once", () => {
  test("found: remembered for 30 days, then asked again", async () => {
    await restaurantMap("lori-smokehouse", NOW);
    await restaurantMap("lori-smokehouse", NOW + REMEMBER_FOUND_MS - 1);
    expect(lookUp).toHaveBeenCalledTimes(1);
    // The picture itself is drawn for each browser that asks: browsers keep it for a day.
    expect(draw).toHaveBeenCalledTimes(2);

    await restaurantMap("lori-smokehouse", NOW + REMEMBER_FOUND_MS);
    expect(lookUp).toHaveBeenCalledTimes(2);
  });

  test("several browsers asking at the same moment share one look-up", async () => {
    let finish!: (point: typeof LORI) => void;
    lookUp.mockReturnValue(new Promise((resolve) => (finish = resolve)));

    const maps = Promise.all([
      restaurantMap("lori-smokehouse", NOW),
      restaurantMap("lori-smokehouse", NOW),
      restaurantMap("lori-smokehouse", NOW),
    ]);
    await vi.waitFor(() => expect(lookUp).toHaveBeenCalledTimes(1));
    finish(LORI);

    expect(await maps).toEqual([PNG, PNG, PNG]);
    expect(lookUp).toHaveBeenCalledTimes(1);
  });

  test("an address Geoapify doesn't know: no map, and not asked again for a day", async () => {
    lookUp.mockResolvedValue(null);

    await expect(restaurantMap("lori-smokehouse", NOW)).rejects.toMatchObject({
      statusCode: 404,
      code: "MAP_NOT_FOUND",
    });
    await expect(
      restaurantMap("lori-smokehouse", NOW + REMEMBER_NOT_FOUND_MS - 1),
    ).rejects.toMatchObject({
      code: "MAP_NOT_FOUND",
    });
    expect(lookUp).toHaveBeenCalledTimes(1);
    expect(draw).not.toHaveBeenCalled();

    await restaurantMap("lori-smokehouse", NOW + REMEMBER_NOT_FOUND_MS).catch(() => {});
    expect(lookUp).toHaveBeenCalledTimes(2);
  });

  test("a changed address is a new look-up", async () => {
    await restaurantMap("lori-smokehouse", NOW);
    findRestaurant.mockResolvedValue({ address: "14 Pushkin Street, Yerevan" } as never);

    await restaurantMap("lori-smokehouse", NOW);

    expect(lookUp.mock.calls).toEqual([
      ["52 Komitas Avenue, Yerevan"],
      ["14 Pushkin Street, Yerevan"],
    ]);
  });
});

describe("when Geoapify fails", () => {
  test("looking up: a 503, and Geoapify isn't asked again for 5 minutes", async () => {
    lookUp.mockRejectedValue(new MapUnavailableError("GEOCODE_429"));

    await expect(restaurantMap("lori-smokehouse", NOW)).rejects.toMatchObject({
      statusCode: 503,
      code: "MAP_UNAVAILABLE",
    });
    await expect(
      restaurantMap("lori-smokehouse", NOW + REMEMBER_FAILURE_MS - 1),
    ).rejects.toMatchObject({ statusCode: 503 });
    expect(lookUp).toHaveBeenCalledTimes(1);

    lookUp.mockResolvedValue(LORI);
    expect(await restaurantMap("lori-smokehouse", NOW + REMEMBER_FAILURE_MS)).toBe(PNG);
  });

  test("drawing: a 503, while the address found stays remembered", async () => {
    draw.mockRejectedValueOnce(new MapUnavailableError("STATIC_MAP_500"));

    await expect(restaurantMap("lori-smokehouse", NOW)).rejects.toMatchObject({
      statusCode: 503,
      code: "MAP_UNAVAILABLE",
    });
    expect(await restaurantMap("lori-smokehouse", NOW)).toBe(PNG);
    expect(lookUp).toHaveBeenCalledTimes(1);
  });
});
