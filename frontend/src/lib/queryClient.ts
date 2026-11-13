import { MutationCache, QueryCache, QueryClient, hashKey } from "@tanstack/react-query";

import { ApiError } from "@/lib/api";
import type { AuthUser } from "@/types/api";

/** The key of the one "who's signed in?" query (features/auth/hooks/useMe.ts). */
export const ME_QUERY_KEY = ["me"] as const;

/**
 * The start of every key holding what one person loaded for themselves: an owner's restaurants and
 * bookings (features/dashboard/queryKeys.ts), a guest's bookings and favorites
 * (features/reservations, features/favorites/favorites.ts), and everything an admin sees
 * (features/admin/admin.ts). A new private key must start with one.
 */
const PRIVATE_KEYS = [["owner"], ["reservations"], ["favorites"], ["admin"]] as const;

/**
 * Forgets what the last person loaded for themselves, so whoever signs in next on this browser
 * never sees it, not even for a moment while their own loads. ["me"] is set separately, by whoever
 * knows who's signed in now.
 */
export function forgetPrivateData(client: QueryClient): void {
  for (const queryKey of PRIVATE_KEYS) {
    // Anything on screen empties at once, and is asked for again as whoever is signed in now. A
    // page keeps its query until it renders again, so taking the query away wouldn't clear it.
    void client.resetQueries({ queryKey, type: "active" });
    client.removeQueries({ queryKey, type: "inactive" });
  }
}

const ME_HASH = hashKey(ME_QUERY_KEY);

/**
 * Forgets the last person's private data as soon as ["me"] says someone else is signed in: an
 * account changed in another tab, which no Sign in or Sign out in this one saw. Signing out isn't
 * a change of person: nothing private shows to nobody, and the next sign-in forgets it anyway.
 * Returns the way to stop watching, for tests.
 */
export function forgetWhenAnotherPersonSignsIn(client: QueryClient): () => void {
  // The last person signed in, or undefined before anyone has been.
  let lastPerson: string | undefined;
  return client.getQueryCache().subscribe((event) => {
    if (event.type !== "updated" || event.query.queryHash !== ME_HASH) return;
    const user = event.query.state.data as AuthUser | null | undefined;
    if (!user) return;
    if (lastPerson !== undefined && user.id !== lastPerson) forgetPrivateData(client);
    lastPerson = user.id;
  });
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

forgetWhenAnotherPersonSignsIn(queryClient);
