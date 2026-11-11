import { z } from "zod";

import { pagingFields } from "../../lib/paging.ts";
import { RESTAURANT_CHANGES } from "./reservations.rules.ts";

/** Enough for a whole day of one restaurant on one page. A busier day continues on the next. */
export const DAY_PAGE_SIZE = 100;

/**
 * GET /api/owner/restaurants/:restaurantId/reservations?date=YYYY-MM-DD, with pages like every
 * list. The date is the restaurant's own calendar date, and stays a string: it's never turned into
 * a moment here, because which moments it covers depends on the restaurant's time zone. Anything
 * else in the query is dropped.
 */
export const reservationDaySchema = z.object({
  date: z.iso.date({ error: "Choose a date, such as 2026-11-14." }),
  ...pagingFields(DAY_PAGE_SIZE, DAY_PAGE_SIZE),
});

export type ReservationDayQuery = z.infer<typeof reservationDaySchema>;

// An optional detail left empty, or only spaces, means "none".
const blankIsNull = (value: unknown): unknown =>
  typeof value === "string" ? value.trim() || null : value;

/**
 * PATCH /api/owner/restaurants/:restaurantId/reservations/:reservationId: the status the booking
 * moves to, and for a cancellation, an optional reason the guest will see. For example
 * { "status": "CONFIRMED" }, or { "status": "CANCELLED", "reason": "We're closed tonight." }.
 */
export const statusChangeSchema = z
  .object({
    status: z.enum(RESTAURANT_CHANGES, {
      error: "Choose confirmed, cancelled, arrived or no-show.",
    }),
    reason: z.preprocess(
      blankIsNull,
      z
        .string({ error: "Enter a reason." })
        .max(200, "Use 200 characters or fewer.")
        .nullable()
        .optional(),
    ),
  })
  .superRefine(({ status, reason }, ctx) => {
    if (reason != null && status !== "CANCELLED") {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Only a cancellation takes a reason.",
      });
    }
  });

export type StatusChangeInput = z.infer<typeof statusChangeSchema>;
