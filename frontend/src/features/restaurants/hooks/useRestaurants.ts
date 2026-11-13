import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import { filtersToParams } from "@/features/restaurants/browseFilters";
import type { BrowseFilters } from "@/features/restaurants/browseFilters";
import { apiGet } from "@/lib/api";
import type { ApiError } from "@/lib/api";
import type { ListResponse, RestaurantSummary } from "@/types/api";

/**
 * One page of restaurants for these filters. Each set of filters is cached on its own, so going
 * Back shows the earlier list at once. While a new list loads, the last one stays on screen. The
 * table looked for (its day, time and party) isn't a filter: the list is the same whatever it is,
 * so it's left out of the request and the cache key, and changing it asks for nothing again.
 */
export function useRestaurants(
  filters: BrowseFilters,
): UseQueryResult<ListResponse<RestaurantSummary>, ApiError> {
  const list: BrowseFilters = { ...filters, date: undefined, time: undefined, guests: undefined };
  return useQuery({
    queryKey: ["restaurants", list],
    queryFn: () => {
      const query = filtersToParams(list).toString();
      return apiGet<ListResponse<RestaurantSummary>>(`/api/restaurants${query ? `?${query}` : ""}`);
    },
    placeholderData: keepPreviousData,
    // One quick retry, then the error shows, instead of about 7 seconds of retrying.
    retry: 1,
  });
}
