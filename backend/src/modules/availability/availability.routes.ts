import { Router } from "express";

import { validate } from "../../middleware/validate.ts";
import { availability } from "./availability.controller.ts";
import { availabilityQuerySchema } from "./availability.schemas.ts";

// A restaurant's free times and tables, at /api/restaurants/:slug/availability. Public, like the
// restaurant's page. restaurants.routes.ts mounts this after checking the slug, so this router
// needs no parameter of its own.
export const availabilityRouter = Router();

availabilityRouter.get("/", validate(availabilityQuerySchema, "query"), availability);
