import type { RequestHandler } from "express";

import type { RestaurantSlugParams } from "../restaurants/restaurants.schemas.ts";
import type { AvailabilityQuery } from "./availability.schemas.ts";
import { getAvailability } from "./availability.service.ts";

// restaurants.routes.ts checks the slug before this module's router runs, and the route checks
// the query. validate() keeps both in res.locals.
export const availability: RequestHandler = async (_req, res) => {
  const { slug } = res.locals["params"] as RestaurantSlugParams;
  res.json(await getAvailability(slug, res.locals["query"] as AvailabilityQuery));
};
