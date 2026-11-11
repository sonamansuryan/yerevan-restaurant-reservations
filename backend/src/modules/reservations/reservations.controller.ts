import type { RequestHandler } from "express";

import type { SessionUser } from "../auth/token.service.ts";
import type { CreateReservationInput } from "./reservations.schemas.ts";
import { createReservation } from "./reservations.service.ts";

// app.ts lets only signed-in guests reach these routes, and `validate` has checked the body.
export const create: RequestHandler = async (req, res) => {
  const { id: userId } = req.user as SessionUser;
  const reservation = await createReservation(userId, req.body as CreateReservationInput);
  res.status(201).json({ reservation });
};
