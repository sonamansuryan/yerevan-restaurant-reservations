import type { RequestHandler } from "express";

import type { SessionUser } from "../auth/token.service.ts";
import type { ReservationDayQuery, StatusChangeInput } from "./owner.schemas.ts";
import { listReservationsForDay } from "./owner.service.ts";
import type { ReservationIdParams } from "./reservations.schemas.ts";
import { changeReservationStatus } from "./reservations.service.ts";

// The router runs requireAuth and requireRestaurantOwner first, and `validate` has checked the
// rest. So req.user is set, and res.locals.restaurantId is this owner's.

export const day: RequestHandler = async (req, res) => {
  const { id: ownerId } = req.user as SessionUser;
  const restaurantId = res.locals["restaurantId"] as string;
  const query = res.locals["query"] as ReservationDayQuery;
  res.json(await listReservationsForDay(ownerId, restaurantId, query));
};

export const changeStatus: RequestHandler = async (req, res) => {
  const { id: ownerId } = req.user as SessionUser;
  const restaurantId = res.locals["restaurantId"] as string;
  const { reservationId } = res.locals["params"] as ReservationIdParams;
  const reservation = await changeReservationStatus(
    ownerId,
    restaurantId,
    reservationId,
    req.body as StatusChangeInput,
  );
  res.json({ reservation });
};
