import { z } from "zod";

import { ReservationStatus, Role } from "../../generated/prisma/enums.ts";
import { blankIsMissing, pagingFields } from "../../lib/paging.ts";

/** Rows per page in the admin's lists, unless the request asks for another number. */
export const ADMIN_PAGE_SIZE = 20;
export const MAX_ADMIN_PAGE_SIZE = 50;

// Trimmed first, so spaces alone are no search at all.
const search = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() || undefined : value),
  z
    .string({ error: "Enter text to search for." })
    .max(100, "Use 100 characters or fewer.")
    .optional(),
);

/** GET /api/admin/users: by name or email, and by role. */
export const adminUserListSchema = z.object({
  q: search,
  role: z.preprocess(
    blankIsMissing,
    z.enum(Role, { error: "Choose guest, owner or admin." }).optional(),
  ),
  ...pagingFields(ADMIN_PAGE_SIZE, MAX_ADMIN_PAGE_SIZE),
});

/** What the admin's restaurant list shows: published, drafts, or the ones Seghan has hidden. */
export const RESTAURANT_STATES = ["published", "draft", "hidden"] as const;

/** GET /api/admin/restaurants: by name or address, and by what guests can see. */
export const adminRestaurantListSchema = z.object({
  q: search,
  show: z.preprocess(
    blankIsMissing,
    z.enum(RESTAURANT_STATES, { error: "Choose published, draft or hidden." }).optional(),
  ),
  ...pagingFields(ADMIN_PAGE_SIZE, MAX_ADMIN_PAGE_SIZE),
});

export const adminRestaurantIdSchema = z.object({
  restaurantId: z.uuid({ error: "Choose a restaurant." }),
});

/** PATCH /api/admin/restaurants/:restaurantId: Seghan hides it from guests, or shows it again. */
export const restaurantVisibilitySchema = z.object({
  hidden: z.boolean({ error: "Choose whether Seghan hides the restaurant." }),
});

/** GET /api/admin/reservations: by restaurant or guest, status, and the day it starts in Yerevan. */
export const adminReservationListSchema = z.object({
  q: search,
  status: z.preprocess(
    blankIsMissing,
    z.enum(ReservationStatus, { error: "Choose a status from the list." }).optional(),
  ),
  date: z.preprocess(
    blankIsMissing,
    z.iso.date({ error: "Choose a date, such as 2026-11-14." }).optional(),
  ),
  ...pagingFields(ADMIN_PAGE_SIZE, MAX_ADMIN_PAGE_SIZE),
});

export type AdminUserListQuery = z.infer<typeof adminUserListSchema>;
export type AdminRestaurantListQuery = z.infer<typeof adminRestaurantListSchema>;
export type AdminRestaurantIdParams = z.infer<typeof adminRestaurantIdSchema>;
export type RestaurantVisibilityInput = z.infer<typeof restaurantVisibilitySchema>;
export type AdminReservationListQuery = z.infer<typeof adminReservationListSchema>;
