import { useInfiniteQuery } from "@tanstack/react-query";

import type { ReviewListState } from "@/features/reviews/components/RestaurantReviews";
import { apiGet } from "@/lib/api";
import type { ListResponse, PublicReview } from "@/types/api";

/**
 * A restaurant's reviews, newest first, ten at a time: Show more adds the next ten below. Nothing
 * is asked for while the restaurant has no reviews.
 */
export function useRestaurantReviews(slug: string, reviewCount: number): ReviewListState {
  const query = useInfiniteQuery({
    queryKey: ["reviews", slug],
    queryFn: ({ pageParam }) =>
      apiGet<ListResponse<PublicReview>>(
        `/api/restaurants/${encodeURIComponent(slug)}/reviews?page=${pageParam}`,
      ),
    initialPageParam: 1,
    getNextPageParam: ({ meta }) =>
      meta.page * meta.pageSize < meta.total ? meta.page + 1 : undefined,
    enabled: reviewCount > 0,
    // One quick retry, then the error shows, instead of about 7 seconds of retrying.
    retry: 1,
  });

  // A retry clears the error while it runs. Staying on the error keeps Try again in its place.
  const retrying = query.isFetching && !query.isFetchingNextPage && query.errorUpdateCount > 0;

  return {
    reviews: query.data?.pages.flatMap((page) => page.data),
    failed: (query.isError && !query.isFetchNextPageError) || (retrying && !query.data),
    retrying,
    onRetry: () => void query.refetch(),
    hasMore: query.hasNextPage,
    loadingMore: query.isFetchingNextPage,
    moreFailed: query.isFetchNextPageError,
    onMore: () => void query.fetchNextPage(),
  };
}
