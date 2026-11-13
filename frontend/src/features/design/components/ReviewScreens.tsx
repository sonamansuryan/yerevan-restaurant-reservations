import type { ReactElement, ReactNode } from "react";

import { Group, Specimens } from "@/features/design/components/parts";
import { sampleReviews } from "@/features/design/samples";
import type { screenStates } from "@/features/design/tokens";
import { RestaurantReviews } from "@/features/reviews/components/RestaurantReviews";
import type { ReviewListState } from "@/features/reviews/components/RestaurantReviews";
import { ReviewForm } from "@/features/reviews/components/ReviewForm";
import { ApiError } from "@/lib/api";

type StateOf<K extends keyof typeof screenStates> = (typeof screenStates)[K][number];

const ignore = (): void => {};
const VISIT = "Lori Smokehouse on Friday 6 November";

/** The question the form sits in, as the modal draws it, without opening over this page. */
function Sheet({ children }: { children: ReactNode }): ReactElement {
  return (
    <div className="rounded-card bg-surface-raised p-8 text-ink shadow-float">
      <h4 className="font-grotesque text-subheading font-bold">Review your visit</h4>
      <div className="mt-3 text-body text-ink-secondary">{children}</div>
    </div>
  );
}

const form = (change: Partial<Parameters<typeof ReviewForm>[0]> = {}): ReactElement => (
  <Sheet>
    <ReviewForm visit={VISIT} onPost={ignore} onClose={ignore} {...change} />
  </Sheet>
);

const written = { rating: "4", comment: "A warm room, and the trout was perfect." } as const;

const reviewForm: Record<StateOf<"reviewForm">, ReactElement> = {
  "Ready (live)": form(),
  "Field errors": form({
    // A thousand and one characters, one too many.
    defaultValues: {
      comment: `${"We sat by the window all evening. ".repeat(30)}Thank you.`.slice(0, 1001),
    },
    validateOnMount: true,
  }),
  Sending: form({ defaultValues: written, sending: true }),
  "Already reviewed": form({
    defaultValues: written,
    error: new ApiError(409, "ALREADY_REVIEWED", "You’ve already reviewed this visit."),
  }),
  "Not marked as arrived": form({
    defaultValues: written,
    error: new ApiError(
      409,
      "NOT_VISITED",
      "You can review a visit once the restaurant has marked you as arrived.",
    ),
  }),
  "No connection": form({
    defaultValues: written,
    error: new ApiError(
      0,
      "NETWORK_ERROR",
      "We can't reach the server right now. Please try again.",
    ),
  }),
};

const list = (change: Partial<ReviewListState> = {}): ReviewListState => ({
  reviews: sampleReviews,
  failed: false,
  retrying: false,
  onRetry: ignore,
  hasMore: true,
  loadingMore: false,
  moreFailed: false,
  onMore: ignore,
  ...change,
});

const reviews = (change: Partial<ReviewListState> = {}, reviewCount = 23): ReactElement => (
  <RestaurantReviews avgRating={4.6} reviewCount={reviewCount} list={list(change)} />
);

const restaurantReviews: Record<StateOf<"restaurantReviews">, ReactElement> = {
  "Newest first, with more to show": reviews(),
  "No reviews yet": reviews({ reviews: undefined, hasMore: false }, 0),
  Loading: reviews({ reviews: undefined, hasMore: false }),
  "Couldn’t load": reviews({ reviews: undefined, hasMore: false, failed: true }),
  "Showing more": reviews({ loadingMore: true }),
  "More couldn’t load": reviews({ moreFailed: true }),
};

/** Reviews: the guest's form for one visit, and the reviews on a restaurant's page. */
export function ReviewScreens(): ReactElement {
  return (
    <>
      <Group
        title="Review a visit"
        note="Opens over My reservations from Review your visit, on a visit the restaurant marked as arrived; see the live past list above. The rating is a choice in words, Excellent to Poor; the words are optional, and the hint says other guests see them with the guest's first name. A refusal shows here, and the form stays open with what was written."
      >
        <Specimens specimens={reviewForm} />
      </Group>
      <Group
        title="Reviews, on a restaurant's page"
        note="Under the description, beside the practical details. The average and the count come with the restaurant; the reviews load ten at a time, newest first. Each starts with the guest's initial in a circle, then the first name, the rating out of 5, the month, and the guest's words with their line breaks."
      >
        <Specimens specimens={restaurantReviews} />
      </Group>
    </>
  );
}
