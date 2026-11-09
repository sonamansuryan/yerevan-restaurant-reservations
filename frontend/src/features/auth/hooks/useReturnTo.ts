import { useLocation } from "react-router";

import { returnPath } from "@/features/auth/returnTo";

/** Where to go once signed in: the page a guard sent this person away from, or home. */
export function useReturnTo(): string {
  return returnPath(useLocation().state);
}
