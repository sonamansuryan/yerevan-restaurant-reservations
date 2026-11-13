import type { ReactElement } from "react";

import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { averageWords, ratingWords, reviewersWords } from "@/features/reviews/reviews";
import { formatMonth } from "@/lib/time";
import type { PublicReview } from "@/types/api";

/** The reviews as they load, a page at a time. */
export interface ReviewListState {
  /** The reviews so far, newest first, or undefined until the first page comes. */
  reviews: PublicReview[] | undefined;
  failed: boolean;
  retrying: boolean;
  onRetry: () => void;
  /** There are more reviews than are shown. */
  hasMore: boolean;
  loadingMore: boolean;
  /** The next page didn't come. Show more tries again. */
  moreFailed: boolean;
  onMore: () => void;
}

interface RestaurantReviewsProps {
  avgRating: number;
  reviewCount: number;
  /** The reviews themselves. Without them, only the summary shows. */
  list?: ReviewListState;
}

/**
 * One review: the guest's initial in a small circle, their first name and the month, the rating,
 * then their words.
 */
function ReviewLine({ review }: { review: PublicReview }): ReactElement {
  return (
    <li className="flex gap-4 border-b border-line py-5">
      <span
        aria-hidden="true"
        className="grid size-10 flex-none place-items-center rounded-pill bg-surface-blush font-semibold"
      >
        {review.author.slice(0, 1)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 font-semibold break-words">{review.author}</p>
          <p className="text-ui font-semibold whitespace-nowrap tabular-nums">
            <span aria-hidden="true">{review.rating}/5</span>
            <span className="sr-only">{ratingWords(review.rating)}</span>
          </p>
        </div>
        <p className="text-meta text-ink-muted">{formatMonth(review.date)}</p>
        {review.comment && (
          // The guest's own line breaks are kept.
          <p className="mt-2 max-w-160 text-ui text-pretty break-words whitespace-pre-line text-ink-secondary">
            {review.comment}
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * A restaurant's reviews: how it's rated on average, then each review, newest first, ten at a time.
 * Only guests the restaurant marked as arrived can write one, so every review is from a real visit.
 */
export function RestaurantReviews({
  avgRating,
  reviewCount,
  list,
}: RestaurantReviewsProps): ReactElement {
  if (reviewCount === 0) {
    return (
      <p className="text-ui text-ink-secondary">
        No reviews yet. Guests can leave one after their visit.
      </p>
    );
  }

  // The large average is for the eye. The sentence beside it says the same in words.
  const summary = (
    <div className="flex items-center gap-5 rounded-band border border-line bg-surface-raised p-5">
      <p aria-hidden="true" className="font-grotesque text-page-title font-bold tabular-nums">
        {averageWords(avgRating)}
      </p>
      <p className="text-ui text-ink-secondary">
        Rated <span className="font-semibold text-ink">{averageWords(avgRating)}</span> out of 5{" "}
        {reviewersWords(reviewCount)}.
      </p>
    </div>
  );
  if (!list) return summary;

  let reviews: ReactElement;
  if (list.failed) {
    reviews = (
      <div className="flex flex-wrap items-baseline gap-x-4">
        <p className="text-ui text-ink-secondary">We couldn’t load the reviews.</p>
        <Button variant="link" loading={list.retrying} onClick={list.onRetry}>
          Try again
        </Button>
      </div>
    );
  } else if (!list.reviews) {
    reviews = (
      <p role="status" className="flex items-center gap-3 text-ui text-ink-muted">
        <Spinner label={null} />
        Loading reviews
      </p>
    );
  } else {
    reviews = (
      <div className="flex flex-col gap-6">
        <ul>
          {list.reviews.map((review) => (
            <ReviewLine key={review.id} review={review} />
          ))}
        </ul>
        {list.moreFailed && (
          <p role="alert" className="text-ui text-ink-secondary">
            We couldn’t load more reviews.
          </p>
        )}
        {list.hasMore && (
          <div>
            <Button variant="ghost" loading={list.loadingMore} onClick={list.onMore}>
              {list.moreFailed ? "Try again" : "Show more reviews"}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {summary}
      {reviews}
    </div>
  );
}
