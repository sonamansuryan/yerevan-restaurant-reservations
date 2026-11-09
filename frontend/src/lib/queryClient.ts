import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/api";

/** The key of the one "who's signed in?" query (features/auth/hooks/useMe.ts). */
export const ME_QUERY_KEY = ["me"] as const;

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
