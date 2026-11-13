import { z } from "zod";

import { pagingFields } from "../../lib/paging.ts";

/** Reviews per page on a restaurant's page, unless the request asks for another number. */
export const REVIEW_PAGE_SIZE = 10;
export const MAX_REVIEW_PAGE_SIZE = 50;

const RATING = "Choose a rating from 1 to 5.";
const COMMENT = "Use 1000 characters or fewer.";

/**
 * POST /api/reservations/:reservationId/review: a rating from 1 to 5, and words if the guest wants.
 * The guest comes from the session and the restaurant from the booking, so neither is sent.
 */
export const createReviewSchema = z.object({
  rating: z.number({ error: RATING }).int(RATING).min(1, RATING).max(5, RATING),
  comment: z
    .string({ error: COMMENT })
    .trim()
    .max(1000, COMMENT)
    .transform((text) => text || null)
    .optional(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

/** GET /api/restaurants/:slug/reviews: newest first, a page at a time like every list. */
export const reviewListSchema = z.object(pagingFields(REVIEW_PAGE_SIZE, MAX_REVIEW_PAGE_SIZE));

export type ReviewListQuery = z.infer<typeof reviewListSchema>;
