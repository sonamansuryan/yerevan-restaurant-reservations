import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationResult } from "@tanstack/react-query";
import { useNavigate } from "react-router";

import { apiPost } from "@/lib/api";
import { ME_QUERY_KEY, forgetPrivateData } from "@/lib/queryClient";

/**
 * Signs out. Only the server can end the session, because the cookies are httpOnly. So if the
 * request fails, the person is still signed in, and the caller shows that rather than pretend.
 */
export function useSignOut(): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: () => apiPost<void>("/api/auth/logout"),
    onSuccess: async () => {
      // Go home first, and only then say nobody's signed in. The other way round, a page that
      // needs an account, such as My reservations, would see nobody while still on screen, and its
      // guard would send the person to Sign in, as if their session had ended. flushSync puts home
      // on screen before navigate() finishes, instead of a moment later.
      await navigate("/", { flushSync: true });
      // Nobody is signed in now, and the server has just said so, so no need to ask it again.
      // Anything else private in the cache goes too, such as an owner's restaurants.
      queryClient.setQueryData(ME_QUERY_KEY, null);
      forgetPrivateData(queryClient);
    },
  });
}
