import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router";

import { useMe } from "@/features/auth/hooks/useMe";
import { returnStateFor } from "@/features/auth/returnTo";
import type { SaveViewer } from "@/features/favorites/components/SaveRestaurant";
import { favoriteKeys, favoriteUrl } from "@/features/favorites/favorites";
import { apiDelete, apiGet, apiPut } from "@/lib/api";
import type { ApiError } from "@/lib/api";
import type { FavoriteState } from "@/types/api";

/**
 * Saving one restaurant from its page. A guest sees whether it's saved, and toggles it. Someone
 * signed out is sent to Sign in and back. Anyone else, or before the app knows who's signed in,
 * gets null: nothing to show.
 */
export function useSaveRestaurant(slug: string): SaveViewer | null {
  const me = useMe();
  const location = useLocation();
  const queryClient = useQueryClient();

  // The last answer stands, as in the header: with none, and no way to ask, nobody is signed in.
  const user = me.data === undefined && me.isError ? null : me.data;
  const isGuest = user?.role === "CUSTOMER";

  const favorite = useQuery<FavoriteState, ApiError>({
    queryKey: favoriteKeys.restaurant(slug),
    queryFn: () => apiGet<FavoriteState>(favoriteUrl(slug)),
    enabled: isGuest,
    retry: 1,
  });

  const toggle = useMutation<FavoriteState, ApiError, boolean>({
    mutationFn: (save) =>
      save ? apiPut<FavoriteState>(favoriteUrl(slug)) : apiDelete<FavoriteState>(favoriteUrl(slug)),
    // The server's answer is the state now, so it's shown as it is.
    onSuccess: (state) => queryClient.setQueryData(favoriteKeys.restaurant(slug), state),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: favoriteKeys.lists }),
  });

  if (user === undefined || (user !== null && !isGuest)) return null;
  if (user === null) return { kind: "signedOut", signIn: returnStateFor(location) };

  // If asking failed, the toggle starts as not saved: saving again is harmless.
  const saved = favorite.isError ? false : favorite.data?.saved;
  return {
    kind: "guest",
    saved,
    saving: toggle.isPending,
    error: toggle.error,
    onToggle: () => toggle.mutate(!saved),
  };
}
