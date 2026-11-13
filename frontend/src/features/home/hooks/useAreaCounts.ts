import { useQueries } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import type { District, ListResponse, RestaurantSummary } from "@/types/api";

/**
 * How many published restaurants each district has, for the home page's tiles, in the same order.
 * Each is one small request to Browse's own list, asking for a single row and reading the total.
 * A count that hasn't come, or couldn't, is undefined: the tile then shows only its name.
 */
export function useAreaCounts(districts: District[]): (number | undefined)[] {
  const results = useQueries({
    queries: districts.map((district) => ({
      queryKey: ["restaurants", "count", district],
      queryFn: () =>
        apiGet<ListResponse<RestaurantSummary>>(`/api/restaurants?district=${district}&pageSize=1`),
      select: (list: ListResponse<RestaurantSummary>) => list.meta.total,
      // One quick retry, as on Browse. The tiles work without their counts.
      retry: 1,
    })),
  });
  return results.map((result) => result.data);
}
