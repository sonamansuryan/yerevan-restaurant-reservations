import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationResult } from "@tanstack/react-query";

import type { SignUpRequest } from "@/features/auth/schemas";
import { apiPost } from "@/lib/api";
import type { ApiError } from "@/lib/api";
import { ME_QUERY_KEY, forgetPrivateData } from "@/lib/queryClient";
import type { AuthResponse, AuthUser } from "@/types/api";

/**
 * Creates an account. The server signs the new account in straight away, and, as with signing in,
 * SignedOutOnly then sends the person on to where they were heading.
 */
export function useSignUp(): UseMutationResult<AuthUser, ApiError, SignUpRequest> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request) =>
      (await apiPost<AuthResponse>("/api/auth/register", request)).user,
    onSuccess: (user) => {
      // A session that ended without Sign out can leave its owner's data behind. It isn't theirs.
      forgetPrivateData(queryClient);
      queryClient.setQueryData(ME_QUERY_KEY, user);
    },
  });
}
