import type { RequestHandler } from "express";

import type { RestaurantListQuery, RestaurantSlugParams } from "./restaurants.schemas.ts";
import { getRestaurant, listRestaurants } from "./restaurants.service.ts";

// The routes run `validate` first, which keeps the checked query and address values in res.locals.
export const list: RequestHandler = async (_req, res) => {
  res.json(await listRestaurants(res.locals["query"] as RestaurantListQuery));
};

export const detail: RequestHandler = async (_req, res) => {
  const { slug } = res.locals["params"] as RestaurantSlugParams;
  res.json({ restaurant: await getRestaurant(slug) });
};
