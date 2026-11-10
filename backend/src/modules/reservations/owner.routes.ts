import { Router } from "express";

import { validate } from "../../middleware/validate.ts";
import { day } from "./owner.controller.ts";
import { reservationDaySchema } from "./owner.schemas.ts";

// One restaurant's bookings, at /api/owner/restaurants/:restaurantId/reservations. owner.routes.ts
// in the restaurants module mounts this after the ownership check, so the restaurant is the
// owner's own. Its id is read from res.locals.restaurantId, so this router needs no parameter.
export const ownerReservationsRouter = Router();

// A day's bookings, to read only. Confirming, cancelling and the rest come in Step 8.
ownerReservationsRouter.get("/", validate(reservationDaySchema, "query"), day);
