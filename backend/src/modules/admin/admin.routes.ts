import { Router } from "express";

import { validate } from "../../middleware/validate.ts";
import { seghan } from "../analytics/analytics.controller.ts";
import { analyticsQuerySchema } from "../analytics/analytics.schemas.ts";
import { reservations, restaurants, users, visibility } from "./admin.controller.ts";
import {
  adminReservationListSchema,
  adminRestaurantIdSchema,
  adminRestaurantListSchema,
  adminUserListSchema,
  restaurantVisibilitySchema,
} from "./admin.schemas.ts";

// At /api/admin, behind requireAuth and requireRole("ADMIN") for every route (app.ts).
export const adminRouter = Router();

adminRouter.get("/users", validate(adminUserListSchema, "query"), users);
adminRouter.get("/restaurants", validate(adminRestaurantListSchema, "query"), restaurants);
adminRouter.patch(
  "/restaurants/:restaurantId",
  validate(adminRestaurantIdSchema, "params"),
  validate(restaurantVisibilitySchema),
  visibility,
);
adminRouter.get("/reservations", validate(adminReservationListSchema, "query"), reservations);
// All of Seghan's numbers, counted as the owner's are (src/modules/analytics).
adminRouter.get("/analytics", validate(analyticsQuerySchema, "query"), seghan);
