import type { RequestHandler } from "express";

import type { SessionUser } from "../auth/token.service.ts";
import {
  createRestaurant,
  getOwnedRestaurant,
  listOwnedRestaurants,
  updateRestaurant,
} from "./owner.service.ts";
import type {
  CreateRestaurantInput,
  OwnerRestaurantListQuery,
  UpdateRestaurantInput,
} from "./restaurants.schemas.ts";

// The router runs requireAuth first, so req.user is set, and `validate` has checked the body.
// Routes under a restaurant also run requireRestaurantOwner, so res.locals.restaurantId is a
// restaurant this owner owns.

export const list: RequestHandler = async (req, res) => {
  const { id: ownerId } = req.user as SessionUser;
  res.json(await listOwnedRestaurants(ownerId, res.locals["query"] as OwnerRestaurantListQuery));
};

export const create: RequestHandler = async (req, res) => {
  const { id: ownerId } = req.user as SessionUser;
  const restaurant = await createRestaurant(ownerId, req.body as CreateRestaurantInput);
  res.status(201).json({ restaurant });
};

export const detail: RequestHandler = async (req, res) => {
  const { id: ownerId } = req.user as SessionUser;
  const restaurantId = res.locals["restaurantId"] as string;
  res.json({ restaurant: await getOwnedRestaurant(ownerId, restaurantId) });
};

export const update: RequestHandler = async (req, res) => {
  const { id: ownerId } = req.user as SessionUser;
  const restaurantId = res.locals["restaurantId"] as string;
  const changes = req.body as UpdateRestaurantInput;
  res.json({ restaurant: await updateRestaurant(ownerId, restaurantId, changes) });
};
