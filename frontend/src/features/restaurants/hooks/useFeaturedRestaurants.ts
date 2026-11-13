import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import type { ApiError } from "@/lib/api";
import type { ListResponse, RestaurantSummary } from "@/types/api";

/** How many restaurants the home page shows: one row on a laptop. */
export const FEATURED_COUNT = 3;

/**
 * The few restaurants on the home page: the ones Seghan features, chosen by hand, filled up with the
 * first others by name (GET /api/restaurants/featured). The reply's total says how many there are
 * in all, for "See all 16 restaurants".
 */
export function useFeaturedRestaurants(): UseQueryResult<
  ListResponse<RestaurantSummary>,
  ApiError
> {
  return useQuery({
    queryKey: ["restaurants", "featured"],
    queryFn: () => apiGet<ListResponse<RestaurantSummary>>("/api/restaurants/featured"),
    // One quick retry, then the error shows, as on Browse.
    retry: 1,
  });
}
