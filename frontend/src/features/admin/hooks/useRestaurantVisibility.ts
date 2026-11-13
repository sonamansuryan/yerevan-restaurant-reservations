import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationResult } from "@tanstack/react-query";

import { adminKeys, adminRestaurantPath } from "@/features/admin/admin";
import { apiPatch } from "@/lib/api";
import type { ApiError } from "@/lib/api";
import type { AdminRestaurant, AdminRestaurantResponse, ListResponse } from "@/types/api";

export interface VisibilityChange {
  restaurant: AdminRestaurant;
  /** True hides it from guests; false shows it again. */
  hidden: boolean;
}

/**
 * Seghan hides a restaurant from guests, or shows it again. Its line changes at once to the
 * server's answer. Then every page of the restaurants list is fetched again, since it may have
 * moved between them, as a hidden one leaves Published, and so are the pages guests see, which
 * this browser may have cached.
 */
export function useRestaurantVisibility(): UseMutationResult<
  AdminRestaurant,
  ApiError,
  VisibilityChange
> {
  const queryClient = useQueryClient();
  return useMutation<AdminRestaurant, ApiError, VisibilityChange>({
    mutationFn: async ({ restaurant, hidden }) =>
      (
        await apiPatch<AdminRestaurantResponse>(adminRestaurantPath(restaurant.id), {
          hidden,
        })
      ).restaurant,
    onSuccess: (changed) => {
      queryClient.setQueriesData<ListResponse<AdminRestaurant>>(
        { queryKey: adminKeys.part("restaurants") },
        (page) =>
          page && {
            ...page,
            data: page.data.map((one) => (one.id === changed.id ? changed : one)),
          },
      );
      void queryClient.invalidateQueries({ queryKey: adminKeys.part("restaurants") });
      void queryClient.invalidateQueries({ queryKey: ["restaurants"] });
      void queryClient.invalidateQueries({ queryKey: ["restaurant"] });
    },
  });
}
