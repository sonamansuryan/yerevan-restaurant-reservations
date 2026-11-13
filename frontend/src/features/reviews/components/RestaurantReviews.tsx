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

/** One review, as a line in the book: the guest's first name, the rating, then their words. */
function ReviewLine({ review }: { review: PublicReview }): ReactElement {
  return (
    <li className="border-b border-line py-5">
      <div className="flex items-baseline gap-3">
        <p className="min-w-0 font-display text-title-xs break-words">{review.author}</p>
        <span aria-hidden="true" className="menu-leader" />
        <p className="text-ui font-medium whitespace-nowrap tabular-nums">
          <span aria-hidden="true">{review.rating}/5</span>
          <span className="sr-only">{ratingWords(review.rating)}</span>
        </p>
      </div>
      <p className="mt-0.5 text-meta text-ink-muted">{formatMonth(review.date)}</p>
      {review.comment && (
        // The guest's own line breaks are kept.
        <p className="mt-3 max-w-160 text-ui text-pretty break-words whitespace-pre-line text-ink-secondary">
          {review.comment}
        </p>
      )}
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

  const summary = (
    <p className="text-ui text-ink-secondary">
      Rated <span className="font-medium text-ink">{averageWords(avgRating)}</span> out of 5{" "}
      {reviewersWords(reviewCount)}.
    </p>
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
        <ul className="border-t border-line">
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
