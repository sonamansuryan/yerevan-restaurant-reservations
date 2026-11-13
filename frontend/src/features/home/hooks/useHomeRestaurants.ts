import { useQuery } from "@tanstack/react-query";

import { HOME_COUNT, homeRestaurants } from "@/features/home/home";
import { useFeaturedRestaurants } from "@/features/restaurants/hooks/useFeaturedRestaurants";
import { apiGet } from "@/lib/api";
import type { ApiError } from "@/lib/api";
import type { ListResponse, RestaurantSummary } from "@/types/api";

export interface HomeRestaurantsState {
  /** The restaurants, with the total Seghan lists, or undefined before the first answer. */
  data: ListResponse<RestaurantSummary> | undefined;
  isError: boolean;
  retrying: boolean;
  refetch: () => void;
}

/**
 * The home page's restaurants: the three Seghan features (GET /api/restaurants/featured), then the
 * first others by name from the list, to fill two rows. If the list doesn't come, the featured ones
 * still show; only if they don't does the page say it couldn't load them.
 */
export function useHomeRestaurants(): HomeRestaurantsState {
  const featured = useFeaturedRestaurants();
  const others = useQuery<ListResponse<RestaurantSummary>, ApiError>({
    queryKey: ["restaurants", "home", HOME_COUNT],
    queryFn: () =>
      apiGet<ListResponse<RestaurantSummary>>(`/api/restaurants?pageSize=${HOME_COUNT}`),
    retry: 1,
  });

  // The featured ones wait for the others, unless those have failed, so the rows fill at once.
  const waiting = others.data === undefined && !others.isError;
  const data =
    featured.data && !waiting
      ? {
          data: homeRestaurants(featured.data.data, others.data?.data ?? []),
          meta: { ...featured.data.meta, pageSize: HOME_COUNT },
        }
      : undefined;

  return {
    data,
    isError: featured.isError,
    retrying: featured.isFetching && featured.errorUpdateCount > 0,
    refetch: () => {
      void featured.refetch();
      void others.refetch();
    },
  };
}
