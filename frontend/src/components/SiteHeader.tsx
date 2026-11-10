import { useState } from "react";
import type { ReactElement } from "react";
import { NavLink } from "react-router";

import { firstName } from "@/components/account";
import type { Account } from "@/components/account";
import { LinkButton } from "@/components/Button";
import { CurrentPageDot, Logo } from "@/components/Logo";
import { MastheadRow, MastheadStart, MenuToggle } from "@/components/Masthead";
import { MobileMenu } from "@/components/MobileMenu";
import { PageContainer } from "@/components/PageContainer";
import { discover, forRestaurants, signIn } from "@/components/site-links";
import type { SiteLink } from "@/components/site-links";
import { cx } from "@/lib/cx";

// The header's serif links and its one button, Sign out, share this look.
const mastheadText =
  "group inline-flex min-h-touch items-center font-display text-title-xs text-ink-secondary transition-[color] duration-button hover:text-ink";
const mastheadUnderline =
  "underline decoration-transparent decoration-1 underline-offset-4 transition-[text-decoration-color] duration-button group-hover:decoration-ink";

function MastheadLink({ link }: { link: SiteLink }): ReactElement {
  return (
    <NavLink
      to={link.to}
      aria-current={link.marksPage === false ? "false" : "page"}
      className={cx(mastheadText, "aria-[current=page]:text-ink")}
    >
      <span className="inline-flex items-baseline gap-1">
        <span className={mastheadUnderline}>{link.label}</span>
        <CurrentPageDot />
      </span>
    </NavLink>
  );
}

/**
 * The header's account corner: Sign in, or Sign out with the person's first name above it, like
 * the name on a place card. While the app is still asking who's signed in, it stays empty, so Sign
 * in never flashes up and turns into a name a moment later.
 */
export function HeaderAccount({ account }: { account: Account }): ReactElement | null {
  const { user, onSignOut, signingOut, signOutFailed } = account;
  if (user === undefined) return null;
  if (user === null) return <MastheadLink link={signIn} />;

  // Set above Sign out and out of the line, so Sign out stays level with the other links and the
  // corner is no wider than before.
  const above = "absolute right-0 bottom-[calc(100%-0.625rem)] font-display text-meta";

  return (
    <span className="relative inline-flex">
      {signOutFailed ? (
        <span role="alert" className={cx(above, "whitespace-nowrap text-error")}>
          Couldn&rsquo;t sign out
        </span>
      ) : (
        // A long name is cut short before it can crowd the links: tablets have the least room.
        <span
          aria-hidden="true"
          className={cx(above, "max-w-24 truncate text-ink-muted lg:max-w-48")}
        >
          {firstName(user.name)}
        </span>
      )}
      <span className="sr-only">Signed in as {user.name}.</span>
      <button
        type="button"
        // While the request is out, a second click would only send it twice.
        onClick={signingOut ? undefined : onSignOut}
        aria-busy={signingOut || undefined}
        aria-disabled={signingOut || undefined}
        className={cx(mastheadText, "aria-busy:text-ink-muted")}
      >
        <span className={mastheadUnderline}>Sign out</span>
      </button>
    </span>
  );
}

interface SiteHeaderProps {
  account: Account;
}

export function SiteHeader({ account }: SiteHeaderProps): ReactElement {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header>
      <PageContainer>
        <MastheadRow>
          {/* The logo and the way around the site, together on the left. */}
          <MastheadStart>
            <Logo className="text-logo text-ink md:text-masthead" />
            <nav aria-label="Main" className="flex items-baseline gap-8 max-md:hidden">
              <MastheadLink link={discover} />
              <MastheadLink link={forRestaurants} />
            </nav>
            <MenuToggle aria-haspopup="dialog" onClick={() => setMenuOpen(true)}>
              Menu
            </MenuToggle>
          </MastheadStart>

          <div className="flex items-center justify-end gap-6">
            <span className="max-md:hidden">
              <HeaderAccount account={account} />
            </span>
            <LinkButton to={discover.to} className="max-md:h-11 max-md:px-4">
              {/* Phones show the short label, and screen readers still hear all of it. */}
              <span>
                Reserve <span className="max-md:sr-only">a table</span>
              </span>
            </LinkButton>
          </div>
        </MastheadRow>
      </PageContainer>
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} account={account} />
    </header>
  );
}
