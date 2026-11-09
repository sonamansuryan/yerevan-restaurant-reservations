import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationResult } from "@tanstack/react-query";
import { useNavigate } from "react-router";

import { apiPost } from "@/lib/api";
import { ME_QUERY_KEY } from "@/lib/queryClient";

/**
 * Signs out. Only the server can end the session, because the cookies are httpOnly. So if the
 * request fails, the person is still signed in, and the caller shows that rather than pretend.
 */
export function useSignOut(): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: () => apiPost<void>("/api/auth/logout"),
    onSuccess: () => {
      // Nobody is signed in now, and the server has just said so, so no need to ask it again.
      // Anything else private in the cache must go too; today ["me"] is the only such query.
      queryClient.setQueryData(ME_QUERY_KEY, null);
      void navigate("/");
    },
  });
}
