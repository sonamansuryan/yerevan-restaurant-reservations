import type { ReactElement } from "react";

import type { Account } from "@/components/account";

/**
 * Who's signed in, at the foot of the dark menu: their initial, their name and Sign out. The
 * dashboard and the admin area have no site header, so this is where people sign out. On a phone
 * it sits at the top of the menu, where the name is left to screen readers to save room. While the
 * app is still asking who's signed in, it stays empty.
 */
export function OfficeAccount({ account }: { account: Account }): ReactElement | null {
  const { user, onSignOut, signingOut, signOutFailed } = account;
  if (!user) return null;

  return (
    <div className="flex min-w-0 items-center gap-3">
      {/* The name is there too, so the initial is only decoration. */}
      <span
        aria-hidden="true"
        className="grid size-9 flex-none place-items-center rounded-pill bg-surface-dark-raised text-ui font-semibold text-on-dark"
      >
        {user.name.trim().slice(0, 1)}
      </span>
      <span className="min-w-0 flex-1 truncate text-ui text-on-dark-secondary max-lg:sr-only">
        <span className="sr-only">Signed in as </span>
        {user.name}
      </span>
      {signOutFailed && (
        <span role="alert" className="text-meta text-accent-on-dark">
          Couldn&rsquo;t sign out
        </span>
      )}
      <button
        type="button"
        // While the request is out, a second click would only send it twice.
        onClick={signingOut ? undefined : onSignOut}
        aria-busy={signingOut || undefined}
        aria-disabled={signingOut || undefined}
        className="inline-flex min-h-touch flex-none items-center text-meta font-medium text-on-dark-secondary underline decoration-transparent underline-offset-4 transition-[color,text-decoration-color] duration-button hover:text-on-dark hover:decoration-current aria-busy:text-on-dark-muted"
      >
        Sign out
      </button>
    </div>
  );
}
