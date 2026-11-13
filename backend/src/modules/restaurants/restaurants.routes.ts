import { Router } from "express";

import { validate } from "../../middleware/validate.ts";
import { availabilityRouter } from "../availability/availability.routes.ts";
import { list as reviews } from "../reviews/reviews.controller.ts";
import { reviewListSchema } from "../reviews/reviews.schemas.ts";
import { detail, featured, list, map } from "./restaurants.controller.ts";
import { restaurantListSchema, restaurantSlugSchema } from "./restaurants.schemas.ts";

// Public: anyone can browse, signed in or not.
export const restaurantsRouter = Router();

restaurantsRouter.get("/", validate(restaurantListSchema, "query"), list);
// The home page's few, chosen by hand. Before /:slug, which "featured" would otherwise match: no
// restaurant can have that address (owner.rules.ts).
restaurantsRouter.get("/featured", featured);
restaurantsRouter.get("/:slug", validate(restaurantSlugSchema, "params"), detail);
// The picture of a published restaurant's street, drawn by Geoapify (9.4).
restaurantsRouter.get("/:slug/map", validate(restaurantSlugSchema, "params"), map);
// A published restaurant's reviews, newest first, a page at a time.
restaurantsRouter.get(
  "/:slug/reviews",
  validate(restaurantSlugSchema, "params"),
  validate(reviewListSchema, "query"),
  reviews,
);
// The times and tables free on a date. The slug is checked here; the router checks the rest.
restaurantsRouter.use(
  "/:slug/availability",
  validate(restaurantSlugSchema, "params"),
  availabilityRouter,
);
