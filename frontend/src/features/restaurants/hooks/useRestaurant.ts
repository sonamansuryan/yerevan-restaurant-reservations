import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import type { ApiError } from "@/lib/api";
import type { RestaurantDetail, RestaurantResponse } from "@/types/api";

/**
 * One restaurant, by the slug in its address. Each restaurant is cached on its own, so going back
 * to one shows it at once. The slug is encoded, so an odd address can't change the request.
 */
export function useRestaurant(slug: string): UseQueryResult<RestaurantDetail, ApiError> {
  return useQuery<RestaurantDetail, ApiError>({
    queryKey: ["restaurant", slug],
    queryFn: async () =>
      (await apiGet<RestaurantResponse>(`/api/restaurants/${encodeURIComponent(slug)}`)).restaurant,
    // A restaurant that isn't there won't appear by asking again. Anything else gets one retry.
    retry: (failures, error) => error.status !== 404 && failures < 1,
  });
}
