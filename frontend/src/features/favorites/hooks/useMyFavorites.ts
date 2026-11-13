import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";

import type { MyFavoritesProps } from "@/features/favorites/components/MyFavorites";
import { favoriteKeys, favoritesPath, favoriteUrl } from "@/features/favorites/favorites";
import { pageFrom } from "@/features/reservations/reservations";
import { apiDelete, apiGet, apiPut } from "@/lib/api";
import type { ApiError } from "@/lib/api";
import type { FavoriteState, ListResponse, RestaurantSummary } from "@/types/api";

interface FavoriteChangeInput {
  restaurant: RestaurantSummary;
  save: boolean;
}

/** My favorites: the page in the address, taking a restaurant out, and putting it back. */
export function useMyFavorites(): MyFavoritesProps {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const page = pageFrom(params);

  const list = useQuery<ListResponse<RestaurantSummary>, ApiError>({
    queryKey: favoriteKeys.list(page),
    queryFn: () =>
      apiGet<ListResponse<RestaurantSummary>>(
        page > 1 ? `/api/favorites?page=${page}` : "/api/favorites",
      ),
    // While another page loads, the last one stays on screen.
    placeholderData: keepPreviousData,
    retry: 1,
  });

  const change = useMutation<FavoriteState, ApiError, FavoriteChangeInput>({
    mutationFn: ({ restaurant, save }) =>
      save
        ? apiPut<FavoriteState>(favoriteUrl(restaurant.slug))
        : apiDelete<FavoriteState>(favoriteUrl(restaurant.slug)),
    // Done or refused, the list and that restaurant's page show it as it now is.
    onSettled: (_reply, _error, { restaurant }) => {
      void queryClient.invalidateQueries({ queryKey: favoriteKeys.lists });
      void queryClient.invalidateQueries({ queryKey: favoriteKeys.restaurant(restaurant.slug) });
    },
  });
  const { reset } = change;

  // What was said about the last change belongs to the page it was made on.
  useEffect(() => {
    reset();
  }, [page, reset]);

  // A retry clears the error while it runs. Staying on the error keeps Try again in its place.
  const retrying = list.isFetching && list.errorUpdateCount > 0 && !list.data;

  return {
    page,
    list: {
      data: list.data,
      failed: (list.isError && !list.data) || retrying,
      retrying,
      onRetry: () => void list.refetch(),
    },
    hrefFor: favoritesPath,
    changingSlug: change.isPending ? (change.variables?.restaurant.slug ?? null) : null,
    changed: change.isSuccess
      ? { restaurant: change.variables.restaurant, saved: change.variables.save }
      : null,
    refusal: change.error,
    onRemove: (restaurant) => change.mutate({ restaurant, save: false }),
    onUndo: (restaurant) => change.mutate({ restaurant, save: true }),
    onFindARestaurant: () => void navigate("/restaurants"),
    onFirstPage: () => void navigate(favoritesPath()),
  };
}
