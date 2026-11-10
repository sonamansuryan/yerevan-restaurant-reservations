import { Router } from "express";

import { validate } from "../../middleware/validate.ts";
import { replace, week } from "./opening-hours.controller.ts";
import { weekSchema } from "./opening-hours.schemas.ts";

// One restaurant's opening hours, at /api/owner/restaurants/:restaurantId/opening-hours.
// owner.routes.ts mounts this after the ownership check, so the restaurant is the owner's own. The
// route reads its id from res.locals.restaurantId, so this router needs no address parameters.
export const openingHoursRouter = Router();

// The whole week at once: GET reads it, and PUT replaces it. Both answer in the same shape.
openingHoursRouter.get("/", week);
openingHoursRouter.put("/", validate(weekSchema), replace);
