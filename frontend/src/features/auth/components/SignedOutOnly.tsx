import type { ReactElement } from "react";
import { Navigate, Outlet } from "react-router";

import { useMe } from "@/features/auth/hooks/useMe";
import { useReturnTo } from "@/features/auth/hooks/useReturnTo";

/**
 * Around Sign in and Create an account, which are for people who aren't signed in. Anyone signed in
 * goes on to where they were heading, or home. That includes someone who has just signed in here:
 * the form only records who's now signed in, and this sends them on, so the rule lives in one place.
 * While the app is still asking, the form shows, because most people here aren't signed in.
 */
export function SignedOutOnly(): ReactElement {
  const me = useMe();
  const returnTo = useReturnTo();

  // replace, so Back doesn't return to a form that has done its job.
  if (me.data) return <Navigate to={returnTo} replace />;
  return <Outlet />;
}
