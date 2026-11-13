import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationResult } from "@tanstack/react-query";

import type { NewReview } from "@/features/reviews/reviews";
import { apiPost } from "@/lib/api";
import type { ApiError } from "@/lib/api";
import type { GuestReservation, GuestReview, ReviewResponse } from "@/types/api";

export interface PostReviewInput {
  /** The visit being reviewed. */
  booking: GuestReservation;
  review: NewReview;
}

/** Posts the guest's review of one visit, which the restaurant marked as arrived. */
export function usePostReview(): UseMutationResult<GuestReview, ApiError, PostReviewInput> {
  const queryClient = useQueryClient();
  return useMutation<GuestReview, ApiError, PostReviewInput>({
    mutationFn: async ({ booking, review }) =>
      (
        await apiPost<ReviewResponse>(
          `/api/reservations/${encodeURIComponent(booking.id)}/review`,
          review,
        )
      ).review,
    // Posted or refused, everything that shows this visit or the restaurant's rating is asked for
    // again: the guest's lists, the restaurant's page and reviews, and Browse.
    onSettled: (_reply, _error, { booking }) => {
      const { slug } = booking.restaurant;
      void queryClient.invalidateQueries({ queryKey: ["reservations"] });
      void queryClient.invalidateQueries({ queryKey: ["restaurant", slug] });
      void queryClient.invalidateQueries({ queryKey: ["reviews", slug] });
      void queryClient.invalidateQueries({ queryKey: ["restaurants"] });
    },
  });
}
