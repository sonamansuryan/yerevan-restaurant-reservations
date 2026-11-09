import type { Account } from "@/components/account";
import { useMe } from "@/features/auth/hooks/useMe";
import { useSignOut } from "@/features/auth/hooks/useSignOut";

/** The session, shaped for the header and the mobile menu. */
export function useAccount(): Account {
  const me = useMe();
  const signOut = useSignOut();

  return {
    // If the server can't be reached, nobody can say who's signed in. Offering Sign in is then the
    // one choice that's never wrong.
    user: me.isError ? null : me.data,
    onSignOut: () => signOut.mutate(),
    signingOut: signOut.isPending,
    signOutFailed: signOut.isError,
  };
}
