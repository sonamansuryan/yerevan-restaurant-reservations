import { z } from "zod";

import { pagingFields } from "../../lib/paging.ts";

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
