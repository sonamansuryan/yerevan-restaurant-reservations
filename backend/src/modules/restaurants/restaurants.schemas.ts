import { z } from "zod";

import { Cuisine, District } from "../../generated/prisma/enums.ts";

/** Restaurants per page, unless the request asks for another number. */
export const PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 48;

// A filter left empty in the address, such as ?cuisine=, means "any", not a mistake. Everything
// in a query string arrives as text, so `coerce` turns "2" into the number 2.
const blankIsMissing = (value: unknown): unknown => (value === "" ? undefined : value);

/**
 * GET /api/restaurants. Anything else in the query, such as ?isPublished=false, is dropped, so
 * nobody can ask for restaurants that aren't published.
 */
export const restaurantListSchema = z.object({
  q: z.preprocess(
    // Trimmed first, so spaces alone are no search at all.
    (value) => (typeof value === "string" ? value.trim() || undefined : value),
    z
      .string({ error: "Enter text to search for." })
      .max(100, "Use 100 characters or fewer.")
      .optional(),
  ),
  cuisine: z.preprocess(
    blankIsMissing,
    z.enum(Cuisine, { error: "Choose a cuisine from the list." }).optional(),
  ),
  district: z.preprocess(
    blankIsMissing,
    z.enum(District, { error: "Choose a district from the list." }).optional(),
  ),
  price: z.preprocess(
    blankIsMissing,
    z.coerce
      .number({ error: "Choose a price from ֏ to ֏֏֏֏." })
      .int("Choose a price from ֏ to ֏֏֏֏.")
      .min(1, "Choose a price from ֏ to ֏֏֏֏.")
      .max(4, "Choose a price from ֏ to ֏֏֏֏.")
      .optional(),
  ),
  page: z.preprocess(
    blankIsMissing,
    z.coerce
      .number({ error: "Choose a page from 1." })
      .int("Choose a page from 1.")
      .min(1, "Choose a page from 1.")
      // Far beyond any real list, and it keeps the database's skip within bounds.
      .max(1000, "Choose a page up to 1000.")
      .default(1),
  ),
  pageSize: z.preprocess(
    blankIsMissing,
    z.coerce
      .number({ error: `Choose a page size from 1 to ${MAX_PAGE_SIZE}.` })
      .int(`Choose a page size from 1 to ${MAX_PAGE_SIZE}.`)
      .min(1, `Choose a page size from 1 to ${MAX_PAGE_SIZE}.`)
      .max(MAX_PAGE_SIZE, `Choose a page size from 1 to ${MAX_PAGE_SIZE}.`)
      .default(PAGE_SIZE),
  ),
});

/** GET /api/restaurants/:slug. Slugs are lowercase, so /restaurants/Nurr still finds nurr. */
export const restaurantSlugSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Choose a restaurant.")
    .max(100, "Choose a restaurant."),
});

export type RestaurantListQuery = z.infer<typeof restaurantListSchema>;
export type RestaurantSlugParams = z.infer<typeof restaurantSlugSchema>;
