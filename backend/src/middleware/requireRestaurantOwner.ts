import type { RequestHandler } from "express";

import { NotFoundError, UnauthorizedError } from "../lib/errors.ts";
import { ownsRestaurant } from "../modules/restaurants/owner.service.ts";
import type { RestaurantIdParams } from "../modules/restaurants/restaurants.schemas.ts";

/**
 * Lets the request through only if the restaurant in the address is the signed-in owner's own.
 *
 * It's the third check, after requireAuth (who are you? or 401) and requireRole (are you an
 * owner? or 403). Someone else's restaurant answers 404, exactly like one that doesn't exist, so
 * trying ids can't reveal which restaurants exist or whose they are.
 *
 * It goes after `validate(restaurantIdSchema, "params")`, and it leaves the checked id in
 * res.locals.restaurantId for the route.
 */
export const requireRestaurantOwner: RequestHandler = async (req, res, next) => {
  // Without requireAuth in front there's no req.user. Refuse rather than let anyone through.
  if (!req.user) throw new UnauthorizedError();

  const params = res.locals["params"] as RestaurantIdParams | undefined;
  // Without the checked id, the router is set up wrongly: a bug (500), never a way in.
  if (!params) throw new Error("requireRestaurantOwner needs validate(restaurantIdSchema) first");

  if (!(await ownsRestaurant(req.user.id, params.restaurantId))) {
    throw new NotFoundError("RESTAURANT_NOT_FOUND");
  }
  res.locals["restaurantId"] = params.restaurantId;
  next();
};
