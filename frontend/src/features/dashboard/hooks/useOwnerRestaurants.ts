import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import { ownerKeys } from "@/features/dashboard/queryKeys";
import { apiGet } from "@/lib/api";
import type { ApiError } from "@/lib/api";
import type { ListResponse, OwnerRestaurant } from "@/types/api";

/** The signed-in owner's restaurants, published or not, by name. One page holds them all. */
export function useOwnerRestaurants(): UseQueryResult<ListResponse<OwnerRestaurant>, ApiError> {
  return useQuery<ListResponse<OwnerRestaurant>, ApiError>({
    queryKey: ownerKeys.restaurants,
    queryFn: () => apiGet<ListResponse<OwnerRestaurant>>("/api/owner/restaurants"),
  });
}
