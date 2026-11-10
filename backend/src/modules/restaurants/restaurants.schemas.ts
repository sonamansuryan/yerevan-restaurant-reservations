import { z } from "zod";

import { Cuisine, District } from "../../generated/prisma/enums.ts";
import { pagingFields } from "../../lib/paging.ts";

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

/**
 * /api/owner/restaurants/:restaurantId and everything under it. Owner addresses use the
 * restaurant's id, which never changes, rather than its public slug. Ids are UUIDs, so anything
 * else is refused before the database is asked.
 */
export const restaurantIdSchema = z.object({
  restaurantId: z.uuid({ error: "Choose a restaurant." }),
});

// An optional detail left empty, or only spaces, means "none". In an edit, that clears it.
const blankIsNull = (value: unknown): unknown =>
  typeof value === "string" ? value.trim() || null : value;

const PHONE = "Enter a phone number, such as +374 10 123456.";
const WEBSITE = "Enter a website address, such as https://example.am.";
const PRICE = "Choose a price from ֏ to ֏֏֏֏.";
const SLOT_INTERVAL = "Choose start times every 15 or 30 minutes.";
const BOOKING_LENGTH =
  "Choose a booking length from 30 minutes to 6 hours, in steps of 15 minutes.";

/**
 * The details an owner gives their restaurant. The database refuses a price outside 1–4, a slot
 * interval other than 15 or 30 and a length of 0, so these rules match it, with messages people
 * can act on. The owner, the address on Seghan (slug), ratings and the time zone aren't here:
 * owners never send those.
 */
const restaurantFields = {
  name: z
    .string({ error: "Enter the restaurant's name." })
    .trim()
    .min(1, "Enter the restaurant's name.")
    .max(80, "Use 80 characters or fewer."),
  description: z.preprocess(
    blankIsNull,
    z
      .string({ error: "Enter a description." })
      .max(1000, "Use 1,000 characters or fewer.")
      .nullable()
      .optional(),
  ),
  cuisines: z
    .array(z.enum(Cuisine, { error: "Choose a cuisine from the list." }), {
      error: "Choose at least one cuisine.",
    })
    .min(1, "Choose at least one cuisine.")
    .max(3, "Choose up to 3 cuisines.")
    .refine((cuisines) => new Set(cuisines).size === cuisines.length, "Choose each cuisine once."),
  district: z.enum(District, { error: "Choose a district from the list." }),
  address: z
    .string({ error: "Enter the address." })
    .trim()
    .min(1, "Enter the address.")
    .max(200, "Use 200 characters or fewer."),
  phone: z.preprocess(
    blankIsNull,
    z
      .string({ error: PHONE })
      .regex(/^\+?[\d ()-]{6,20}$/, PHONE)
      .nullable()
      .optional(),
  ),
  website: z.preprocess(
    blankIsNull,
    // Only http and https, on a real domain: never javascript: or a bare name.
    z
      .url({ protocol: /^https?$/, hostname: z.regexes.domain, error: WEBSITE })
      .max(200, "Use 200 characters or fewer.")
      .nullable()
      .optional(),
  ),
  priceLevel: z.number({ error: PRICE }).int(PRICE).min(1, PRICE).max(4, PRICE),
  // How often start times are offered (§5.2).
  slotIntervalMin: z.union([z.literal(15), z.literal(30)], { error: SLOT_INTERVAL }),
  // How long one booking holds its table.
  reservationDurationMin: z
    .number({ error: BOOKING_LENGTH })
    .int(BOOKING_LENGTH)
    .min(30, BOOKING_LENGTH)
    .max(360, BOOKING_LENGTH)
    .multipleOf(15, BOOKING_LENGTH),
};

/**
 * POST /api/owner/restaurants. A new restaurant always starts unpublished, so isPublished isn't
 * accepted here. Without a slot interval or booking length, the database's 30 and 120 apply.
 */
export const createRestaurantSchema = z.object({
  ...restaurantFields,
  slotIntervalMin: restaurantFields.slotIntervalMin.optional(),
  reservationDurationMin: restaurantFields.reservationDurationMin.optional(),
});

/** PATCH /api/owner/restaurants/:restaurantId. Any of the details, and whether guests can see it. */
export const updateRestaurantSchema = z
  .object({
    ...restaurantFields,
    isPublished: z.boolean({ error: "Choose whether guests can see the restaurant." }),
  })
  .partial()
  .refine(
    (changes) => Object.values(changes).some((value) => value !== undefined),
    "Change at least one detail.",
  );

/**
 * GET /api/owner/restaurants: the signed-in owner's own restaurants, published or not. One page
 * holds them all, unless an owner has more than 48 (MAX_PAGE_SIZE).
 */
export const ownerRestaurantListSchema = z.object(pagingFields(MAX_PAGE_SIZE, MAX_PAGE_SIZE));

export type RestaurantListQuery = z.infer<typeof restaurantListSchema>;
export type OwnerRestaurantListQuery = z.infer<typeof ownerRestaurantListSchema>;
export type RestaurantSlugParams = z.infer<typeof restaurantSlugSchema>;
export type RestaurantIdParams = z.infer<typeof restaurantIdSchema>;
export type CreateRestaurantInput = z.infer<typeof createRestaurantSchema>;
export type UpdateRestaurantInput = z.infer<typeof updateRestaurantSchema>;
