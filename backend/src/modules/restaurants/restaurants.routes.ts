import { Router } from "express";

import { validate } from "../../middleware/validate.ts";
import { availabilityRouter } from "../availability/availability.routes.ts";
import { detail, list } from "./restaurants.controller.ts";
import { restaurantListSchema, restaurantSlugSchema } from "./restaurants.schemas.ts";

// Public: anyone can browse, signed in or not.
export const restaurantsRouter = Router();

restaurantsRouter.get("/", validate(restaurantListSchema, "query"), list);
restaurantsRouter.get("/:slug", validate(restaurantSlugSchema, "params"), detail);
// The times and tables free on a date. The slug is checked here; the router checks the rest.
restaurantsRouter.use(
  "/:slug/availability",
  validate(restaurantSlugSchema, "params"),
  availabilityRouter,
);
