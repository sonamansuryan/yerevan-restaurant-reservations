import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/api";

/** The key of the one "who's signed in?" query (features/auth/hooks/useMe.ts). */
export const ME_QUERY_KEY = ["me"] as const;

/**
 * Forgets what the last person loaded for themselves, so whoever signs in next on this browser
 * never sees it, not even for a moment while their own loads. Today that's an owner's restaurants
 * and bookings, whose keys all start with "owner" (features/dashboard/queryKeys.ts). ["me"] is set
 * separately, by whoever knows who's signed in now.
 */
export function forgetPrivateData(client: QueryClient): void {
  client.removeQueries({ queryKey: ["owner"] });
}

// A 401 that gets this far comes after api.ts has already tried to renew the session, so the
// session has ended. Marking nobody as signed in updates the header at once, whichever request
// found out.
function endSessionOn401(error: Error): void {
  if (error instanceof ApiError && error.status === 401) {
    queryClient.setQueryData(ME_QUERY_KEY, null);
  }
}

// One client for the whole app, so every component shares the same cache of server data.
export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: endSessionOn401 }),
  mutationCache: new MutationCache({ onError: endSessionOn401 }),
});
