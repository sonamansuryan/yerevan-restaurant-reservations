import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationResult } from "@tanstack/react-query";

import type { SignUpRole } from "@/features/auth/schemas";
import { apiPost } from "@/lib/api";
import type { ApiError } from "@/lib/api";
import { ME_QUERY_KEY } from "@/lib/queryClient";
import type { AuthResponse, AuthUser } from "@/types/api";

export interface GoogleSignInRequest {
  /** The ID token that Google gave the page. The server checks it with Google's public keys. */
  credential: string;
  /** For a new account, from Create an account. Someone who already has one keeps their role. */
  role?: SignUpRole;
}

/**
 * Signs in with Google, and creates the account the first time. The server checks Google's token,
 * then starts the same session as any sign-in. As with useSignIn, putting the reply into ["me"]
 * lets SignedOutOnly send the person on to where they were heading.
 */
export function useGoogleSignIn(): UseMutationResult<AuthUser, ApiError, GoogleSignInRequest> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request) => (await apiPost<AuthResponse>("/api/auth/google", request)).user,
    onSuccess: (user) => {
      queryClient.setQueryData(ME_QUERY_KEY, user);
    },
  });
}
