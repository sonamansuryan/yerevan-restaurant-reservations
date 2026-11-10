import { Router } from "express";

import { requireRestaurantOwner } from "../../middleware/requireRestaurantOwner.ts";
import { validate } from "../../middleware/validate.ts";
import { openingHoursRouter } from "../opening-hours/opening-hours.routes.ts";
import { photosRouter } from "../photos/photos.routes.ts";
import { ownerReservationsRouter } from "../reservations/owner.routes.ts";
import { create, detail, list, update } from "./owner.controller.ts";
import {
  createRestaurantSchema,
  ownerRestaurantListSchema,
  restaurantIdSchema,
  updateRestaurantSchema,
} from "./restaurants.schemas.ts";

// An owner's own restaurants, at /api/owner/restaurants. app.ts lets only signed-in owners this
// far (401 or 403 otherwise).
export const ownerRestaurantsRouter = Router();

// The owner's own restaurants: the list goes by the owner in the session, so it needs no check.
ownerRestaurantsRouter.get("/", validate(ownerRestaurantListSchema, "query"), list);
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
ownerRestaurantsRouter.use("/:restaurantId/reservations", ownerReservationsRouter);
