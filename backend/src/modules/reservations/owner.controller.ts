import type { RequestHandler } from "express";

import type { SessionUser } from "../auth/token.service.ts";
import type { ReservationDayQuery } from "./owner.schemas.ts";
import { listReservationsForDay } from "./owner.service.ts";

// The router runs requireAuth and requireRestaurantOwner first, and `validate` keeps the checked
// query in res.locals.query. So req.user is set, and res.locals.restaurantId is this owner's.
export const day: RequestHandler = async (req, res) => {
  const { id: ownerId } = req.user as SessionUser;
  const restaurantId = res.locals["restaurantId"] as string;
  const query = res.locals["query"] as ReservationDayQuery;
  res.json(await listReservationsForDay(ownerId, restaurantId, query));
};
