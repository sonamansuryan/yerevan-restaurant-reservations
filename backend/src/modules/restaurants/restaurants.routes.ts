import { Router } from "express";

import { validate } from "../../middleware/validate.ts";
import { detail, list } from "./restaurants.controller.ts";
import { restaurantListSchema, restaurantSlugSchema } from "./restaurants.schemas.ts";

// Public: anyone can browse, signed in or not.
export const restaurantsRouter = Router();

restaurantsRouter.get("/", validate(restaurantListSchema, "query"), list);
restaurantsRouter.get("/:slug", validate(restaurantSlugSchema, "params"), detail);
