import { z } from "zod";

import type { ChoiceOption } from "@/components/ChoiceLines";
import { guestsWords } from "@/features/dashboard/labels";

/** The five ratings in the words a guest chooses from, the best first. */
export const RATING_CHOICES: ChoiceOption[] = [
  { value: "5", label: "Excellent", note: "5" },
  { value: "4", label: "Very good", note: "4" },
  { value: "3", label: "Good", note: "3" },
  { value: "2", label: "Fair", note: "2" },
  { value: "1", label: "Poor", note: "1" },
];

/**
 * The review form, by the server's rules. A radio's value is text, so the rating is too until it's
 * sent. Blank words count as none.
 */
export const reviewSchema = z.object({
  rating: z.enum(["1", "2", "3", "4", "5"], { error: "Choose a rating." }),
  comment: z.string().trim().max(1000, "Use 1000 characters or fewer."),
});

export type ReviewFields = z.input<typeof reviewSchema>;
export type ReviewValues = z.output<typeof reviewSchema>;

/** What POST /api/reservations/:reservationId/review takes. */
export interface NewReview {
  rating: number;
  comment?: string;
}

export function toNewReview({ rating, comment }: ReviewValues): NewReview {
  return { rating: Number(rating), ...(comment ? { comment } : {}) };
}

/** An average as people see it, to one decimal: "4.6". */
export function averageWords(average: number): string {
  return average.toFixed(1);
}

/** "5 out of 5". */
export function ratingWords(rating: number): string {
  return `${rating} out of 5`;
}

/** "by 1 guest", "by 23 guests": who gave a restaurant its rating. */
export function reviewersWords(count: number): string {
  return `by ${guestsWords(count)}`;
}
