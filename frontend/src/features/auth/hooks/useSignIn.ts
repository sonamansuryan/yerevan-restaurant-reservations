import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationResult } from "@tanstack/react-query";

import type { SignInRequest } from "@/features/auth/schemas";
import { apiPost } from "@/lib/api";
import type { ApiError } from "@/lib/api";
import { ME_QUERY_KEY } from "@/lib/queryClient";
import type { AuthResponse, AuthUser } from "@/types/api";

/**
 * Signs in. The server sets the session cookies, and its reply says who's now signed in. Putting
 * that into ["me"] updates the header at once, and SignedOutOnly, around the Sign in page, then
 * sends the person on to where they were heading.
 */
export function useSignIn(): UseMutationResult<AuthUser, ApiError, SignInRequest> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request) => (await apiPost<AuthResponse>("/api/auth/login", request)).user,
    onSuccess: (user) => {
      queryClient.setQueryData(ME_QUERY_KEY, user);
    },
  });
}
