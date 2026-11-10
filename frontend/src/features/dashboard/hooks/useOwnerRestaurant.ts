import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import { ownerKeys, ownerRestaurantPath } from "@/features/dashboard/queryKeys";
import { apiGet } from "@/lib/api";
import type { ApiError } from "@/lib/api";
import type { OwnerRestaurant, OwnerRestaurantResponse } from "@/types/api";

/**
 * One of the owner's restaurants. Someone else's, or one that doesn't exist, is a 404, and an
 * address that isn't a restaurant id at all is a 400.
 */
export function useOwnerRestaurant(id: string): UseQueryResult<OwnerRestaurant, ApiError> {
  return useQuery<OwnerRestaurant, ApiError>({
    queryKey: ownerKeys.restaurant(id),
    queryFn: async () =>
      (await apiGet<OwnerRestaurantResponse>(ownerRestaurantPath(id))).restaurant,
    // Asking again won't make a restaurant appear. Anything else gets one retry.
    retry: (failures, error) => error.status !== 404 && error.status !== 400 && failures < 1,
  });
}
