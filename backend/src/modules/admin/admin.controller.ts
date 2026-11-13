import type { RequestHandler } from "express";

import type { SessionUser } from "../auth/token.service.ts";
import type {
  AdminReservationListQuery,
  AdminRestaurantIdParams,
  AdminRestaurantListQuery,
  AdminUserListQuery,
  RestaurantVisibilityInput,
} from "./admin.schemas.ts";
import {
  listReservationsForAdmin,
  listRestaurantsForAdmin,
  listUsers,
  setRestaurantHidden,
} from "./admin.service.ts";

// The routes have checked the input with `validate`, and the area is for admins only (app.ts).

export const users: RequestHandler = async (_req, res) => {
  res.json(await listUsers(res.locals["query"] as AdminUserListQuery));
};

export const restaurants: RequestHandler = async (_req, res) => {
  res.json(await listRestaurantsForAdmin(res.locals["query"] as AdminRestaurantListQuery));
};

export const visibility: RequestHandler = async (req, res) => {
  const { id: adminId } = req.user as SessionUser;
  const { restaurantId } = res.locals["params"] as AdminRestaurantIdParams;
  const { hidden } = req.body as RestaurantVisibilityInput;
  res.json({ restaurant: await setRestaurantHidden(adminId, restaurantId, hidden) });
};

export const reservations: RequestHandler = async (_req, res) => {
  res.json(await listReservationsForAdmin(res.locals["query"] as AdminReservationListQuery));
};
