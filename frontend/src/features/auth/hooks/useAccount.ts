import type { Account } from "@/components/account";
import { useMe } from "@/features/auth/hooks/useMe";
import { useSignOut } from "@/features/auth/hooks/useSignOut";

/** The session, shaped for the header and the mobile menu. */
export function useAccount(): Account {
  const me = useMe();
  const signOut = useSignOut();

  // The last answer stands, even if a later check in the background fails, as in RequireAuth. With
  // no answer at all and the server out of reach, nobody can say who's signed in, so the header
  // offers Sign in, the one choice that's never wrong.
  let user = me.data;
  if (user === undefined && me.isError) user = null;

  return {
    user,
    onSignOut: () => signOut.mutate(),
    signingOut: signOut.isPending,
    signOutFailed: signOut.isError,
  };
}
