import type { RequestHandler } from "express";

import type { SessionUser } from "../auth/token.service.ts";
import type { WeekInput } from "./opening-hours.schemas.ts";
import { replaceWeek } from "./opening-hours.service.ts";

// The router runs requireAuth and requireRestaurantOwner first, and `validate` has checked the
// week. So req.user is set, and res.locals.restaurantId is a restaurant this owner owns.
export const replace: RequestHandler = async (req, res) => {
  const { id: ownerId } = req.user as SessionUser;
  const restaurantId = res.locals["restaurantId"] as string;
  const { hours } = req.body as WeekInput;
  res.json({ openingHours: await replaceWeek(ownerId, restaurantId, hours) });
};
