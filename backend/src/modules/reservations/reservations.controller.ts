import type { RequestHandler } from "express";

import type { SessionUser } from "../auth/token.service.ts";
import type {
  CreateReservationInput,
  GuestReservationListQuery,
  ReservationIdParams,
} from "./reservations.schemas.ts";
import {
  cancelReservation,
  createReservation,
  listGuestReservations,
} from "./reservations.service.ts";

// app.ts lets only signed-in guests reach these routes, and `validate` has checked the input. The
// guest is always the one signed in, never someone the request names.

export const list: RequestHandler = async (req, res) => {
  const { id: userId } = req.user as SessionUser;
  const query = res.locals["query"] as GuestReservationListQuery;
  res.json(await listGuestReservations(userId, query));
};

export const create: RequestHandler = async (req, res) => {
  const { id: userId } = req.user as SessionUser;
  const reservation = await createReservation(userId, req.body as CreateReservationInput);
  res.status(201).json({ reservation });
};

export const cancel: RequestHandler = async (req, res) => {
  const { id: userId } = req.user as SessionUser;
  const { reservationId } = res.locals["params"] as ReservationIdParams;
  const reservation = await cancelReservation(userId, reservationId);
  res.json({ reservation });
};
