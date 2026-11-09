import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiGet } from "@/lib/api";
import { ME_QUERY_KEY } from "@/lib/queryClient";
import type { AuthResponse, AuthUser } from "@/types/api";

/**
 * Who's signed in: a user, or null for nobody. The session lives in httpOnly cookies, which this
 * code can't read, so the only way to know is to ask the server.
 */
export function useMe(): UseQueryResult<AuthUser | null> {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: fetchMe,
    // A problem shows at once. TanStack Query would otherwise retry for about 7 seconds first.
    retry: false,
  });
}

async function fetchMe(): Promise<AuthUser | null> {
  try {
    const { user } = await apiGet<AuthResponse>("/api/me");
    return user;
  } catch (error) {
    // api.ts has already tried to renew the session, so a 401 means nobody is signed in. That's an
    // answer, not a failure.
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}
