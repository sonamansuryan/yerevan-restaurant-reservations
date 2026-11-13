import { useQuery } from "@tanstack/react-query";

import type { SavedPreviewState } from "@/features/favorites/components/SavedRestaurants";
import { favoriteKeys } from "@/features/favorites/favorites";
import { apiGet } from "@/lib/api";
import type { ApiError } from "@/lib/api";
import type { ListResponse, RestaurantSummary } from "@/types/api";

/**
 * The first of the guest's saved restaurants, for the side of My reservations. It's the first page
 * of their favorites, under the same key as My favorites, so each fills the other.
 */
export function useSavedPreview(): SavedPreviewState {
  const list = useQuery<ListResponse<RestaurantSummary>, ApiError>({
    queryKey: favoriteKeys.list(1),
    queryFn: () => apiGet<ListResponse<RestaurantSummary>>("/api/favorites"),
    retry: 1,
  });
  return { data: list.data, failed: list.isError };
}
