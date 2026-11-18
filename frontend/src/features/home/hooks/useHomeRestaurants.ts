import { useQuery } from "@tanstack/react-query";

import { HOME_COUNT, HOME_LIST_SIZE, homeRestaurants } from "@/features/home/home";
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
 * first others by name from the list, to fill two rows, all but those it doesn't show
 * (shownOnHome). If the list doesn't come, the featured ones still show. If they don't come either,
 * or the page leaves them all out, it says it couldn't load the restaurants.
 */
export function useHomeRestaurants(): HomeRestaurantsState {
  const featured = useFeaturedRestaurants();
  const others = useQuery<ListResponse<RestaurantSummary>, ApiError>({
    queryKey: ["restaurants", "home", HOME_LIST_SIZE],
    queryFn: () =>
      apiGet<ListResponse<RestaurantSummary>>(`/api/restaurants?pageSize=${HOME_LIST_SIZE}`),
    retry: 1,
  });

  // The featured ones wait for the others, unless those have failed, so the rows fill at once.
  const waiting = others.data === undefined && !others.isError;
  const shown =
    featured.data && !waiting
      ? homeRestaurants(featured.data.data, others.data?.data ?? [])
      : undefined;
  // Without the others, only the featured ones are left, and the page may leave out all of them: in
  // the public demo, they're real places with no photo (shownOnHome). Then nothing came that it can
  // show, which is a failure to load, not a Seghan with no restaurants.
  const nothingLeft = others.isError && shown?.length === 0;
  const data =
    featured.data && shown && !nothingLeft
      ? { data: shown, meta: { ...featured.data.meta, pageSize: HOME_COUNT } }
      : undefined;

  return {
    data,
    isError: featured.isError || nothingLeft,
    // Either request being asked again after it failed, while the page shows the error.
    retrying:
      (featured.isFetching && featured.errorUpdateCount > 0) || (nothingLeft && others.isFetching),
    refetch: () => {
      void featured.refetch();
      void others.refetch();
    },
  };
}
