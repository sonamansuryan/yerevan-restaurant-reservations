import { Router } from "express";

import { validate } from "../../middleware/validate.ts";
import { create } from "./reservations.controller.ts";
import { createReservationSchema } from "./reservations.schemas.ts";

// A guest's bookings, at /api/reservations. app.ts lets only signed-in guests in.
export const reservationsRouter = Router();

reservationsRouter.post("/", validate(createReservationSchema), create);
