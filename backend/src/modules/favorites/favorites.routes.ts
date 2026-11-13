import { Router } from "express";

import { validate } from "../../middleware/validate.ts";
import { restaurantSlugSchema } from "../restaurants/restaurants.schemas.ts";
import { list, remove, save, show } from "./favorites.controller.ts";
import { favoriteListSchema } from "./favorites.schemas.ts";

// At /api/favorites, behind requireAuth and requireRole("CUSTOMER"): a guest's own favorites, each
// named by its restaurant's address on Seghan (its slug), as the restaurant's page is.
export const favoritesRouter = Router();

favoritesRouter.get("/", validate(favoriteListSchema, "query"), list);
favoritesRouter.get("/:slug", validate(restaurantSlugSchema, "params"), show);
// PUT and DELETE can be repeated: the restaurant ends up saved, or not, whatever came before.
favoritesRouter.put("/:slug", validate(restaurantSlugSchema, "params"), save);
favoritesRouter.delete("/:slug", validate(restaurantSlugSchema, "params"), remove);
