import { Router } from "express";

import { requireRestaurantOwner } from "../../middleware/requireRestaurantOwner.ts";
import { validate } from "../../middleware/validate.ts";
import { openingHoursRouter } from "../opening-hours/opening-hours.routes.ts";
import { photosRouter } from "../photos/photos.routes.ts";
import { create, detail, update } from "./owner.controller.ts";
import {
  createRestaurantSchema,
  restaurantIdSchema,
  updateRestaurantSchema,
} from "./restaurants.schemas.ts";

// An owner's own restaurants, at /api/owner/restaurants. app.ts lets only signed-in owners this
// far (401 or 403 otherwise).
export const ownerRestaurantsRouter = Router();

ownerRestaurantsRouter.post("/", validate(createRestaurantSchema), create);

// Everything about one restaurant lives under /:restaurantId. This one line checks that it's the
// signed-in owner's own, for every route below it, now and in later tasks, so none can forget.
// It runs before any body is checked, so someone else's restaurant gets 404, never a 400 with
// details about it.
ownerRestaurantsRouter.use(
  "/:restaurantId",
  validate(restaurantIdSchema, "params"),
  requireRestaurantOwner,
);

ownerRestaurantsRouter.get("/:restaurantId", detail);
ownerRestaurantsRouter.patch("/:restaurantId", validate(updateRestaurantSchema), update);

// Each part of a restaurant lives below it, behind the same check.
ownerRestaurantsRouter.use("/:restaurantId/opening-hours", openingHoursRouter);
ownerRestaurantsRouter.use("/:restaurantId/photos", photosRouter);
