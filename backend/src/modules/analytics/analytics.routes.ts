import { Router } from "express";

import { validate } from "../../middleware/validate.ts";
import { restaurant } from "./analytics.controller.ts";
import { analyticsQuerySchema } from "./analytics.schemas.ts";

// One restaurant's numbers, at /api/owner/restaurants/:restaurantId/analytics. owner.routes.ts in
// the restaurants module mounts this after the ownership check, so the restaurant is the owner's
// own. All of Seghan's numbers are the admin's, at /api/admin/analytics (admin.routes.ts).
export const ownerAnalyticsRouter = Router();

ownerAnalyticsRouter.get("/", validate(analyticsQuerySchema, "query"), restaurant);
