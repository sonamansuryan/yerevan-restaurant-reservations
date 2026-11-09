import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationResult } from "@tanstack/react-query";
import { useNavigate } from "react-router";

import type { SignInRequest } from "@/features/auth/schemas";
import { apiPost } from "@/lib/api";
import type { ApiError } from "@/lib/api";
import { ME_QUERY_KEY } from "@/lib/queryClient";
import type { AuthResponse, AuthUser } from "@/types/api";

/** Signs in. The server sets the session cookies, and its reply says who's now signed in. */
export function useSignIn(): UseMutationResult<AuthUser, ApiError, SignInRequest> {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (request) => (await apiPost<AuthResponse>("/api/auth/login", request)).user,
    onSuccess: (user) => {
      // The reply already names the person, so the header can show them without asking again.
      queryClient.setQueryData(ME_QUERY_KEY, user);
      // replace: Back shouldn't return to a form that's done its job. Task 2.7 will bring people
      // back to the page they came from instead of home.
      void navigate("/", { replace: true });
    },
  });
}
