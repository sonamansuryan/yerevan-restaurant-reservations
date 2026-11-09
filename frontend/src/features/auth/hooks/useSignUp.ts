import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationResult } from "@tanstack/react-query";
import { useNavigate } from "react-router";

import type { SignUpRequest } from "@/features/auth/schemas";
import { apiPost } from "@/lib/api";
import type { ApiError } from "@/lib/api";
import { ME_QUERY_KEY } from "@/lib/queryClient";
import type { AuthResponse, AuthUser } from "@/types/api";

/** Creates an account. The server signs the new account in straight away. */
export function useSignUp(): UseMutationResult<AuthUser, ApiError, SignUpRequest> {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (request) =>
      (await apiPost<AuthResponse>("/api/auth/register", request)).user,
    onSuccess: (user) => {
      queryClient.setQueryData(ME_QUERY_KEY, user);
      void navigate("/", { replace: true });
    },
  });
}
