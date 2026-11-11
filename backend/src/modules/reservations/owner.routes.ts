import { Router } from "express";

import { validate } from "../../middleware/validate.ts";
import { changeStatus, day } from "./owner.controller.ts";
import { reservationDaySchema, statusChangeSchema } from "./owner.schemas.ts";
import { reservationIdSchema } from "./reservations.schemas.ts";

// One restaurant's bookings, at /api/owner/restaurants/:restaurantId/reservations. owner.routes.ts
// in the restaurants module mounts this after the ownership check, so the restaurant is the
// owner's own. Its id is read from res.locals.restaurantId, so this router needs no parameter.
export const ownerReservationsRouter = Router();

// A day's bookings, and moving one on: confirmed, cancelled, arrived or no-show.
ownerReservationsRouter.get("/", validate(reservationDaySchema, "query"), day);
ownerReservationsRouter.patch(
  "/:reservationId",
  validate(reservationIdSchema, "params"),
  validate(statusChangeSchema),
  changeStatus,
);
