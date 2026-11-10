import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import { filtersToParams } from "@/features/restaurants/browseFilters";
import type { BrowseFilters } from "@/features/restaurants/browseFilters";
import { apiGet } from "@/lib/api";
import type { ApiError } from "@/lib/api";
import type { ListResponse, RestaurantSummary } from "@/types/api";

/**
 * One page of restaurants for these filters. Each set of filters is cached on its own, so going
 * Back shows the earlier list at once. While a new list loads, the last one stays on screen.
 */
export function useRestaurants(
  filters: BrowseFilters,
): UseQueryResult<ListResponse<RestaurantSummary>, ApiError> {
  return useQuery({
    queryKey: ["restaurants", filters],
    queryFn: () => {
      const query = filtersToParams(filters).toString();
      return apiGet<ListResponse<RestaurantSummary>>(`/api/restaurants${query ? `?${query}` : ""}`);
    },
    placeholderData: keepPreviousData,
    // One quick retry, then the error shows, instead of about 7 seconds of retrying.
    retry: 1,
  });
}
