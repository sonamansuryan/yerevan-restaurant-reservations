import type { RequestHandler } from "express";

import type { SessionUser } from "../auth/token.service.ts";
import type { AnalyticsQuery } from "./analytics.schemas.ts";
import { restaurantAnalytics, seghanAnalytics } from "./analytics.service.ts";

// The routes have checked the input with `validate`. The owner's route runs after
// requireRestaurantOwner, so res.locals.restaurantId is the owner's own restaurant, and the
// admin's is for admins only (app.ts).

export const restaurant: RequestHandler = async (req, res) => {
  const { id: ownerId } = req.user as SessionUser;
  const restaurantId = res.locals["restaurantId"] as string;
  const query = res.locals["query"] as AnalyticsQuery;
  res.json({ analytics: await restaurantAnalytics(ownerId, restaurantId, query) });
};

export const seghan: RequestHandler = async (_req, res) => {
  res.json({ analytics: await seghanAnalytics(res.locals["query"] as AnalyticsQuery) });
};
