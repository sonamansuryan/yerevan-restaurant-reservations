import { z } from "zod";

import { pagingFields } from "../../lib/paging.ts";
import { MAX_PAGE_SIZE, PAGE_SIZE } from "../restaurants/restaurants.schemas.ts";

/** GET /api/favorites: a page at a time, as many to a page as Browse shows. */
export const favoriteListSchema = z.object(pagingFields(PAGE_SIZE, MAX_PAGE_SIZE));

export type FavoriteListQuery = z.infer<typeof favoriteListSchema>;
