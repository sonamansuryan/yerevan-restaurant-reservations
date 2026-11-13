// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

import { RestaurantReviews } from "@/features/reviews/components/RestaurantReviews";
import type { ReviewListState } from "@/features/reviews/components/RestaurantReviews";
import type { PublicReview } from "@/types/api";

afterEach(cleanup);

const lilit: PublicReview = {
  id: "review-lilit",
  rating: 5,
  comment: "The trout was perfect.\nWe sat by the window.",
  author: "Lilit",
  date: "2026-11-06",
  createdAt: "2026-11-06T19:00:00.000Z",
};
const aram: PublicReview = {
  id: "review-aram",
  rating: 3,
  comment: null,
  author: "Aram",
  date: "2026-10-31",
  createdAt: "2026-10-31T18:00:00.000Z",
};

const list = (change: Partial<ReviewListState> = {}): ReviewListState => ({
  reviews: [lilit, aram],
  failed: false,
  retrying: false,
  onRetry: vi.fn(),
  hasMore: false,
  loadingMore: false,
  moreFailed: false,
  onMore: vi.fn(),
  ...change,
});

test("no reviews yet: it says so, and who can leave one", () => {
  render(<RestaurantReviews avgRating={0} reviewCount={0} list={list({ reviews: undefined })} />);

  expect(document.body.textContent).toBe("No reviews yet. Guests can leave one after their visit.");
  expect(screen.queryByRole("status")).toBeNull();
});

test("the average to one decimal, and how many guests gave it", () => {
  render(<RestaurantReviews avgRating={4.25} reviewCount={23} list={list()} />);

  expect(screen.getByText(/^Rated/).textContent).toBe("Rated 4.3 out of 5 by 23 guests.");
});

test("one guest is a guest, and the large average is for the eye only", () => {
  render(<RestaurantReviews avgRating={5} reviewCount={1} />);

  expect(screen.getByText(/^Rated/).textContent).toBe("Rated 5.0 out of 5 by 1 guest.");
  const large = screen.getByText("5.0", { selector: "p" });
  expect(large.getAttribute("aria-hidden")).toBe("true");
});

test("each review: the first name, the rating out of 5, the month, and the words with their line breaks", () => {
  render(<RestaurantReviews avgRating={4} reviewCount={2} list={list()} />);

  const [first, second] = screen.getAllByRole("listitem");
  expect(within(first!).getByText("Lilit")).toBeDefined();
  expect(within(first!).getByText("5 out of 5")).toBeDefined();
  expect(within(first!).getByText("November 2026")).toBeDefined();
  const words = within(first!).getByText(/The trout was perfect/);
  expect(words.textContent).toBe("The trout was perfect.\nWe sat by the window.");
  expect(words.className).toContain("whitespace-pre-line");
  // A review without words is the name, the rating and the month alone, after an initial that
  // screen readers skip.
  const initial = second!.querySelector('[aria-hidden="true"]');
  expect(initial?.textContent).toBe("A");
  expect(second!.textContent).toBe("AAram3/53 out of 5October 2026");
});

test("while the reviews load, the summary stays and says it's loading them", () => {
  render(<RestaurantReviews avgRating={4} reviewCount={2} list={list({ reviews: undefined })} />);

  expect(screen.getByText(/^Rated/)).toBeDefined();
  expect(screen.getByRole("status").textContent).toBe("Loading reviews");
});

test("when they can't load: a short note and Try again", async () => {
  const onRetry = vi.fn();
  render(
    <RestaurantReviews
      avgRating={4}
      reviewCount={2}
      list={list({ reviews: undefined, failed: true, onRetry })}
    />,
  );

  expect(screen.getByText("We couldn’t load the reviews.")).toBeDefined();
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(onRetry).toHaveBeenCalled();
});

test("more than ten: Show more reviews adds the next ten, and waits while they come", async () => {
  const onMore = vi.fn();
  const { rerender } = render(
    <RestaurantReviews avgRating={4} reviewCount={23} list={list({ hasMore: true, onMore })} />,
  );

  await userEvent.click(screen.getByRole("button", { name: "Show more reviews" }));
  expect(onMore).toHaveBeenCalled();

  rerender(
    <RestaurantReviews
      avgRating={4}
      reviewCount={23}
      list={list({ hasMore: true, loadingMore: true, onMore })}
    />,
  );
  expect(screen.getByRole("button", { name: "Show more reviews" }).getAttribute("aria-busy")).toBe(
    "true",
  );
});

test("when the next ten don't come, it says so, and the button tries again", () => {
  render(
    <RestaurantReviews
      avgRating={4}
      reviewCount={23}
      list={list({ hasMore: true, moreFailed: true })}
    />,
  );

  expect(screen.getByRole("alert").textContent).toBe("We couldn’t load more reviews.");
  expect(screen.getByRole("button", { name: "Try again" })).toBeDefined();
  // The reviews already shown stay.
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
});
