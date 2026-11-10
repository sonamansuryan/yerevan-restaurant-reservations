// requireRestaurantOwner (src/middleware/requireRestaurantOwner.ts) on its own, with the database's
// answer to "is this restaurant theirs?" given by hand. owner-restaurants.test.ts tests it in place.
import type { NextFunction, Request, Response } from "express";
import { afterEach, expect, test, vi } from "vitest";

import { NotFoundError, UnauthorizedError } from "../src/lib/errors.ts";
import { requireRestaurantOwner } from "../src/middleware/requireRestaurantOwner.ts";
import { ownsRestaurant } from "../src/modules/restaurants/owner.service.ts";
import { ani } from "./fixtures/users.ts";

vi.mock("../src/modules/restaurants/owner.service.ts", () => ({ ownsRestaurant: vi.fn() }));

const RESTAURANT = "c3f6e5a4-7d8b-4c9f-a01a-2b3c4d5e6f70";

afterEach(() => {
  vi.clearAllMocks();
});

/** Runs the middleware with only what it reads: req.user, and the checked id in res.locals. */
function run(user: Request["user"], params?: { restaurantId: string }) {
  const req = { user } as unknown as Request;
  const res = { locals: params ? { params } : {} } as unknown as Response;
  const next = vi.fn();
  const done = Promise.resolve(requireRestaurantOwner(req, res, next as unknown as NextFunction));
  return { done, res, next };
}

test("lets the owner through, and leaves the checked id for the route", async () => {
  vi.mocked(ownsRestaurant).mockResolvedValue(true);

  const { done, res, next } = run(ani, { restaurantId: RESTAURANT });
  await done;

  expect(ownsRestaurant).toHaveBeenCalledWith(ani.id, RESTAURANT);
  expect(next).toHaveBeenCalledWith();
  expect(res.locals["restaurantId"]).toBe(RESTAURANT);
});

test("someone else's restaurant: 404, and the route never runs", async () => {
  vi.mocked(ownsRestaurant).mockResolvedValue(false);

  const { done, res, next } = run(ani, { restaurantId: RESTAURANT });

  await expect(done).rejects.toThrow(NotFoundError);
  await expect(done).rejects.toMatchObject({ statusCode: 404, code: "RESTAURANT_NOT_FOUND" });
  expect(next).not.toHaveBeenCalled();
  expect(res.locals["restaurantId"]).toBeUndefined();
});

test("without requireAuth in front: 401, and the database is never asked", async () => {
  const { done, next } = run(undefined, { restaurantId: RESTAURANT });

  await expect(done).rejects.toThrow(UnauthorizedError);
  expect(ownsRestaurant).not.toHaveBeenCalled();
  expect(next).not.toHaveBeenCalled();
});

test("without the checked id in front: an error (500), never a way in", async () => {
  const { done, next } = run(ani);

  await expect(done).rejects.toThrow("needs validate(restaurantIdSchema) first");
  expect(ownsRestaurant).not.toHaveBeenCalled();
  expect(next).not.toHaveBeenCalled();
});
