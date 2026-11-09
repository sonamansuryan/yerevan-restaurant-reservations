import type { ReactElement, ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router";

import { PageContainer } from "@/components/PageContainer";
import {
  AccountCheckFailed,
  CheckingAccount,
  NotForThisAccount,
} from "@/features/auth/components/GuardStates";
import { useMe } from "@/features/auth/hooks/useMe";
import { returnStateFor } from "@/features/auth/returnTo";
import type { AuthUser } from "@/types/api";

interface RequireAuthProps {
  /** The roles allowed in. Anyone signed in, when left out. */
  roles?: AuthUser["role"][];
  /** What anyone else is told, such as "This page is for restaurants". */
  notAllowedTitle?: string;
}

/** A guard's message, set as a page of its own, with its own title and heading. */
function GuardPage({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <PageContainer className="flex flex-col items-center gap-6 py-section-sm md:py-section-lg">
      <title>{`${title} · Seghan`}</title>
      <h1 className="sr-only">{title}</h1>
      {children}
    </PageContainer>
  );
}

/**
 * Guards the pages inside it, and shows them through <Outlet /> when it may.
 * - Someone signed out is sent to Sign in, along with where they were heading, so they come back
 *   once signed in.
 * - Someone signed in with another role is told the page isn't for them.
 *
 * This only decides what the browser shows. The API checks every request itself, with requireAuth
 * and requireRole, and that's the real protection: anyone can get past code in their own browser.
 */
export function RequireAuth({
  roles,
  notAllowedTitle = "This page isn’t for your account",
}: RequireAuthProps): ReactElement {
  const me = useMe();
  const location = useLocation();

  // No answer yet. Once there is one, it stands, even if a later check in the background fails.
  if (me.data === undefined) {
    // A retry clears the error while it runs. Staying on the error keeps Try again on the page.
    const retrying = me.isFetching && me.errorUpdateCount > 0;
    if (me.isError || retrying) {
      return (
        <GuardPage title="Something went wrong">
          <AccountCheckFailed onRetry={() => void me.refetch()} retrying={retrying} />
        </GuardPage>
      );
    }
    // Deciding before the answer arrives would send signed-in people to Sign in on every reload.
    return (
      <PageContainer className="page-fill flex items-center justify-center py-section-sm">
        <CheckingAccount />
      </PageContainer>
    );
  }

  if (me.data === null) {
    // replace, so Back doesn't bounce between this page and Sign in.
    return <Navigate to="/login" replace state={returnStateFor(location)} />;
  }

  if (roles && !roles.includes(me.data.role)) {
    return (
      <GuardPage title={notAllowedTitle}>
        <NotForThisAccount title={notAllowedTitle} name={me.data.name} />
      </GuardPage>
    );
  }

  return <Outlet />;
}
