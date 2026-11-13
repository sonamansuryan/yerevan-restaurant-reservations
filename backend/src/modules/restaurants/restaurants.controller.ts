import type { RequestHandler } from "express";

import type { RestaurantListQuery, RestaurantSlugParams } from "./restaurants.schemas.ts";
import { restaurantMap } from "./restaurant-map.service.ts";
import { getRestaurant, listFeatured, listRestaurants } from "./restaurants.service.ts";

// The routes run `validate` first, which keeps the checked query and address values in res.locals.
export const list: RequestHandler = async (_req, res) => {
  res.json(await listRestaurants(res.locals["query"] as RestaurantListQuery));
};

export const featured: RequestHandler = async (_req, res) => {
  res.json(await listFeatured());
};

export const detail: RequestHandler = async (_req, res) => {
  const { slug } = res.locals["params"] as RestaurantSlugParams;
  res.json({ restaurant: await getRestaurant(slug) });
};

export const map: RequestHandler = async (_req, res) => {
  const { slug } = res.locals["params"] as RestaurantSlugParams;
  const image = await restaurantMap(slug);
  // Browsers keep the picture for a day, so a returning visitor costs Geoapify nothing.
  res.set("Cache-Control", "public, max-age=86400").type("png").send(Buffer.from(image));
};
