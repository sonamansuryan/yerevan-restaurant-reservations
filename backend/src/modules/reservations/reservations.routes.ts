import { Router } from "express";

import { validate } from "../../middleware/validate.ts";
import { cancel, create, list } from "./reservations.controller.ts";
import {
  cancelReservationSchema,
  createReservationSchema,
  guestReservationListSchema,
  reservationIdSchema,
} from "./reservations.schemas.ts";

// A guest's bookings, at /api/reservations. app.ts lets only signed-in guests in.
export const reservationsRouter = Router();

reservationsRouter.get("/", validate(guestReservationListSchema, "query"), list);
reservationsRouter.post("/", validate(createReservationSchema), create);
reservationsRouter.patch(
  "/:reservationId",
  validate(reservationIdSchema, "params"),
  validate(cancelReservationSchema),
  cancel,
);
