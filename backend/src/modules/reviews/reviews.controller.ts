import type { RequestHandler } from "express";

import type { SessionUser } from "../auth/token.service.ts";
import type { ReservationIdParams } from "../reservations/reservations.schemas.ts";
import type { RestaurantSlugParams } from "../restaurants/restaurants.schemas.ts";
import type { CreateReviewInput, ReviewListQuery } from "./reviews.schemas.ts";
import { createReview, listReviews } from "./reviews.service.ts";

// The routes have checked the input with `validate`. Posting is for signed-in guests only, and the
// guest is always the one signed in, never someone the request names.

export const create: RequestHandler = async (req, res) => {
  const { id: userId } = req.user as SessionUser;
  const { reservationId } = res.locals["params"] as ReservationIdParams;
  const review = await createReview(userId, reservationId, req.body as CreateReviewInput);
  res.status(201).json({ review });
};

export const list: RequestHandler = async (_req, res) => {
  const { slug } = res.locals["params"] as RestaurantSlugParams;
  res.json(await listReviews(slug, res.locals["query"] as ReviewListQuery));
};
