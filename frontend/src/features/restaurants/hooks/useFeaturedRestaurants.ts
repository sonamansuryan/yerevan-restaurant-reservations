import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import type { ApiError } from "@/lib/api";
import type { ListResponse, RestaurantSummary } from "@/types/api";

/** How many restaurants the home page shows: one row on a laptop. */
export const FEATURED_COUNT = 3;

/**
 * The few restaurants on the home page: the first by name, until reviews can rank them. The reply's
 * total also says how many there are in all, for "See all 6 restaurants".
 */
export function useFeaturedRestaurants(): UseQueryResult<
  ListResponse<RestaurantSummary>,
  ApiError
> {
  return useQuery({
    queryKey: ["restaurants", "featured"],
    queryFn: () =>
      apiGet<ListResponse<RestaurantSummary>>(`/api/restaurants?pageSize=${FEATURED_COUNT}`),
    // One quick retry, then the error shows, as on Browse.
    retry: 1,
  });
}
