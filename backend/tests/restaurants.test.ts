// GET /api/restaurants and /api/restaurants/:slug, with the service replaced: these tests cover the
// addresses, the input checks and the replies. The queries are in restaurants.service.test.ts.
import request from "supertest";
import { afterEach, describe, expect, test, vi } from "vitest";

import { app } from "../src/app.ts";
import { NotFoundError, ServiceUnavailableError } from "../src/lib/errors.ts";
import { restaurantMap } from "../src/modules/restaurants/restaurant-map.service.ts";
import {
  getRestaurant,
  listFeatured,
  listRestaurants,
} from "../src/modules/restaurants/restaurants.service.ts";
import { detailReply, listReply } from "./fixtures/restaurants.ts";

vi.mock("../src/modules/restaurants/restaurant-map.service.ts", () => ({
  restaurantMap: vi.fn(),
}));

vi.mock("../src/modules/restaurants/restaurants.service.ts", () => ({
  listRestaurants: vi.fn(),
  listFeatured: vi.fn(),
  getRestaurant: vi.fn(),
}));

const list = vi.mocked(listRestaurants);
const detail = vi.mocked(getRestaurant);

afterEach(() => {
  list.mockReset();
  detail.mockReset();
  vi.mocked(restaurantMap).mockReset();
});

const browse = (query = ""): request.Test => request(app).get(`/api/restaurants${query}`);

describe("GET /api/restaurants/featured", () => {
  test("answers the home page's few, for anyone, and is never taken for a restaurant's address", async () => {
    vi.mocked(listFeatured).mockResolvedValue({
      ...listReply,
      meta: { page: 1, pageSize: 3, total: 16 },
    });

    const reply = await request(app).get("/api/restaurants/featured");

    expect(reply.status).toBe(200);
    expect(reply.body).toEqual({ ...listReply, meta: { page: 1, pageSize: 3, total: 16 } });
    expect(detail).not.toHaveBeenCalled();
  });

  test("a failure reaches the error middleware as any other: 500, with nothing of it in the reply", async () => {
    vi.mocked(listFeatured).mockRejectedValue(new Error("boom"));

    const reply = await request(app).get("/api/restaurants/featured");

    expect(reply.status).toBe(500);
    expect(JSON.stringify(reply.body)).not.toContain("boom");
  });
});

describe("GET /api/restaurants", () => {
  test("lists restaurants for anyone, signed in or not, by name, on page 1 of 12 by default", async () => {
    list.mockResolvedValue(listReply);

    const reply = await browse();

    expect(reply.status).toBe(200);
    expect(reply.body).toEqual(listReply);
    expect(list).toHaveBeenCalledWith({ sort: "name", page: 1, pageSize: 12 });
  });

  test("passes on the search, the filters and the page, cleaned", async () => {
    list.mockResolvedValue(listReply);

    await browse(
      "?q=%20%20wine%20&cuisine=GEORGIAN&district=KENTRON&price=2&sort=rating&page=2&pageSize=6",
    );

    expect(list).toHaveBeenCalledWith({
      q: "wine",
      cuisine: "GEORGIAN",
      district: "KENTRON",
      price: 2,
      sort: "rating",
      page: 2,
      pageSize: 6,
    });
  });

  test("an empty filter means any, as a cleared form sends it", async () => {
    list.mockResolvedValue(listReply);

    await browse("?q=%20&cuisine=&district=&price=&sort=&page=&pageSize=");

    expect(list).toHaveBeenCalledWith({ sort: "name", page: 1, pageSize: 12 });
  });

  test("nobody can ask for unpublished restaurants: unknown parameters are dropped", async () => {
    list.mockResolvedValue(listReply);

    await browse("?isPublished=false&ownerId=someone&slug=davtashen-test-kitchen");

    expect(list).toHaveBeenCalledWith({ sort: "name", page: 1, pageSize: 12 });
  });

  test.each<[string, string, Record<string, string>]>([
    ["an unknown cuisine", "?cuisine=PIZZA", { cuisine: "Choose a cuisine from the list." }],
    ["a cuisine in lowercase", "?cuisine=georgian", { cuisine: "Choose a cuisine from the list." }],
    [
      "two cuisines",
      "?cuisine=GEORGIAN&cuisine=SEAFOOD",
      { cuisine: "Choose a cuisine from the list." },
    ],
    ["an unknown district", "?district=CASCADE", { district: "Choose a district from the list." }],
    ["a price above ֏֏֏֏", "?price=5", { price: "Choose a price from ֏ to ֏֏֏֏." }],
    ["a price that isn't a number", "?price=cheap", { price: "Choose a price from ֏ to ֏֏֏֏." }],
    ["an unknown order", "?sort=price", { sort: "Choose to sort by name or rating." }],
    ["an order in capitals", "?sort=RATING", { sort: "Choose to sort by name or rating." }],
    ["page 0", "?page=0", { page: "Choose a page from 1." }],
    ["half a page", "?page=1.5", { page: "Choose a page from 1." }],
    ["a page far too far", "?page=1001", { page: "Choose a page up to 1000." }],
    ["too many at once", "?pageSize=49", { pageSize: "Choose a page size from 1 to 48." }],
    ["a search too long", `?q=${"a".repeat(101)}`, { q: "Use 100 characters or fewer." }],
  ])(
    "%s gets 400 with a message for that field, and nothing is looked up",
    async (_c, query, fields) => {
      const reply = await browse(query);

      expect(reply.status).toBe(400);
      expect(reply.body.error).toEqual({
        code: "VALIDATION_ERROR",
        message: "The request is invalid.",
        details: { fields },
      });
      expect(list).not.toHaveBeenCalled();
    },
  );
});

describe("GET /api/restaurants/:slug/map", () => {
  const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  test("anyone gets the picture of its street, which browsers keep for a day", async () => {
    vi.mocked(restaurantMap).mockResolvedValue(PNG);

    const reply = await request(app).get("/api/restaurants/Lori-Smokehouse/map").buffer(true);

    expect(reply.status).toBe(200);
    expect(reply.headers["content-type"]).toBe("image/png");
    expect(reply.headers["cache-control"]).toBe("public, max-age=86400");
    expect([...new Uint8Array(reply.body as Buffer)]).toEqual([...PNG]);
    expect(restaurantMap).toHaveBeenCalledWith("lori-smokehouse");
  });

  test("no map, or a restaurant that isn't there, is a 404 in our format", async () => {
    vi.mocked(restaurantMap).mockRejectedValue(new NotFoundError("MAP_NOT_FOUND"));

    const reply = await request(app).get("/api/restaurants/lori-smokehouse/map");

    expect(reply.status).toBe(404);
    expect(reply.body.error).toEqual({
      code: "MAP_NOT_FOUND",
      message: "There’s no map of this address.",
    });
  });

  test("Geoapify failing is a 503, so the page shows the address alone", async () => {
    vi.mocked(restaurantMap).mockRejectedValue(new ServiceUnavailableError("MAP_UNAVAILABLE"));

    const reply = await request(app).get("/api/restaurants/lori-smokehouse/map");

    expect(reply.status).toBe(503);
    expect(reply.body.error.code).toBe("MAP_UNAVAILABLE");
  });

  test("an address far too long is a 400, and no map is asked for", async () => {
    const reply = await request(app).get(`/api/restaurants/${"a".repeat(101)}/map`);

    expect(reply.status).toBe(400);
    expect(restaurantMap).not.toHaveBeenCalled();
  });
});

describe("GET /api/restaurants/:slug", () => {
  test("gives a restaurant's page to anyone", async () => {
    detail.mockResolvedValue(detailReply);

    const reply = await request(app).get("/api/restaurants/tsiran-wine-room");

    expect(reply.status).toBe(200);
    expect(reply.body).toEqual({ restaurant: detailReply });
    expect(detail).toHaveBeenCalledWith("tsiran-wine-room");
  });

  test("capitals in the address still find it", async () => {
    detail.mockResolvedValue(detailReply);

    await request(app).get("/api/restaurants/Tsiran-Wine-Room");

    expect(detail).toHaveBeenCalledWith("tsiran-wine-room");
  });

  test("one that doesn't exist, or isn't published, gets 404", async () => {
    detail.mockRejectedValue(new NotFoundError("RESTAURANT_NOT_FOUND"));

    const reply = await request(app).get("/api/restaurants/davtashen-test-kitchen");

    expect(reply.status).toBe(404);
    expect(reply.body).toEqual({
      error: { code: "RESTAURANT_NOT_FOUND", message: "We couldn’t find this restaurant." },
    });
  });

  test("an address far too long gets 400, and nothing is looked up", async () => {
    const reply = await request(app).get(`/api/restaurants/${"a".repeat(101)}`);

    expect(reply.status).toBe(400);
    expect(reply.body.error.details).toEqual({ fields: { slug: "Choose a restaurant." } });
    expect(detail).not.toHaveBeenCalled();
  });

  test("an unknown path under it is still a 404 in our format", async () => {
    const reply = await request(app).get("/api/restaurants/nurr/menu");

    expect(reply.status).toBe(404);
    expect(reply.body.error.code).toBe("ROUTE_NOT_FOUND");
  });
});
