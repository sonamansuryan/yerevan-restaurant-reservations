import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryClient, UseMutationResult } from "@tanstack/react-query";

import { ownerKeys, ownerRestaurantPath } from "@/features/dashboard/queryKeys";
import type { RestaurantRequest } from "@/features/dashboard/schemas";
import { apiPatch, apiPost } from "@/lib/api";
import type { ApiError } from "@/lib/api";
import type { OwnerRestaurant, OwnerRestaurantResponse } from "@/types/api";

/** A change to a restaurant: any of its details, and whether guests can see it. */
export type RestaurantChange = Partial<RestaurantRequest> & { isPublished?: boolean };

/**
 * After a save, the owner's copy is the server's answer, so it's shown at once. Their list and the
 * pages guests see are fetched again the next time they're needed.
 */
function remember(queryClient: QueryClient, restaurant: OwnerRestaurant): void {
  queryClient.setQueryData(ownerKeys.restaurant(restaurant.id), restaurant);
  void queryClient.invalidateQueries({ queryKey: ownerKeys.restaurants });
  void queryClient.invalidateQueries({ queryKey: ["restaurants"] });
  void queryClient.invalidateQueries({ queryKey: ["restaurant"] });
}

/** Adds a restaurant for the signed-in owner. It starts as a draft. */
export function useCreateRestaurant(): UseMutationResult<
  OwnerRestaurant,
  ApiError,
  RestaurantRequest
> {
  const queryClient = useQueryClient();
  return useMutation<OwnerRestaurant, ApiError, RestaurantRequest>({
    mutationFn: async (request) =>
      (await apiPost<OwnerRestaurantResponse>("/api/owner/restaurants", request)).restaurant,
    onSuccess: (restaurant) => remember(queryClient, restaurant),
  });
}

/** Changes one of the owner's restaurants: its details, or publishing it. */
export function useUpdateRestaurant(
  id: string,
): UseMutationResult<OwnerRestaurant, ApiError, RestaurantChange> {
  const queryClient = useQueryClient();
  return useMutation<OwnerRestaurant, ApiError, RestaurantChange>({
    mutationFn: async (change) =>
      (await apiPatch<OwnerRestaurantResponse>(ownerRestaurantPath(id), change)).restaurant,
    onSuccess: (restaurant) => remember(queryClient, restaurant),
  });
}
