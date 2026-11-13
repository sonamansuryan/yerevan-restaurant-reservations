import { useState } from "react";
import type { ReactElement } from "react";
import { Link, NavLink } from "react-router";

import { firstName } from "@/components/account";
import type { Account } from "@/components/account";
import { Logo } from "@/components/Logo";
import { MastheadRow, MastheadStart, MenuToggle, outlinePill } from "@/components/Masthead";
import { MobileMenu } from "@/components/MobileMenu";
import { PageContainer } from "@/components/PageContainer";
import { forRestaurants, mainLinks, signIn } from "@/components/site-links";
import type { SiteLink } from "@/components/site-links";

// The page you're on is in ink. The others are quieter, until hovered.
const navLink =
  "inline-flex min-h-touch items-center text-input font-medium text-ink-secondary transition-[color] duration-button hover:text-ink aria-[current=page]:text-ink";

// For restaurants, beside Sign in: a quiet word, as in the export.
const quietLink =
  "inline-flex min-h-touch items-center text-ui font-medium whitespace-nowrap text-ink-secondary transition-[color] duration-button hover:text-ink";

function MastheadLink({ link }: { link: SiteLink }): ReactElement {
  return (
    <NavLink
      to={link.to}
      aria-current={link.marksPage === false ? "false" : "page"}
      className={navLink}
    >
      {link.label}
    </NavLink>
  );
}

/** The way around the site, for whoever is signed in: see mainLinks(). */
export function MainLinks({ user }: { user: Account["user"] }): ReactElement {
  return (
    <>
      {mainLinks(user).map((link) => (
        <MastheadLink key={link.to} link={link} />
      ))}
    </>
  );
}

/**
 * The header's account corner: Sign in, or the person's initial and first name with Sign out.
 * While the app is still asking who's signed in, it stays empty, so Sign in never flashes up and
 * turns into a name a moment later.
 */
export function HeaderAccount({ account }: { account: Account }): ReactElement | null {
  const { user, onSignOut, signingOut, signOutFailed } = account;
  if (user === undefined) return null;
  if (user === null) {
    return (
      <Link to={signIn.to} className={outlinePill}>
        {signIn.label}
      </Link>
    );
  }

  return (
    <span className="flex items-center gap-3">
      {/* The name is on screen, so the initial is only decoration. */}
      <span
        aria-hidden="true"
        className="grid size-9 flex-none place-items-center rounded-pill bg-surface-blush text-ui font-semibold text-ink"
      >
        {user.name.trim().slice(0, 1)}
      </span>
      {signOutFailed ? (
        <span role="alert" className="text-meta whitespace-nowrap text-error">
          Couldn&rsquo;t sign out
        </span>
      ) : (
        // A long name is cut short before it can crowd the links: tablets have the least room.
        <span aria-hidden="true" className="max-w-28 truncate text-ui font-semibold lg:max-w-48">
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
        className="inline-flex min-h-touch items-center text-ui font-medium text-ink-secondary underline decoration-transparent underline-offset-4 transition-[color,text-decoration-color] duration-button hover:text-ink hover:decoration-ink aria-busy:text-ink-muted"
      >
        Sign out
      </button>
    </span>
  );
}

interface SiteHeaderProps {
  account: Account;
}

/**
 * The white bar at the top of every guest page, as the export has it: the logo and the way around
 * the site on the left, and on the right For restaurants and Sign in, or the person signed in.
 * Phones show the logo, Sign in and Menu, which opens the same links in a sheet.
 */
export function SiteHeader({ account }: SiteHeaderProps): ReactElement {
  const [menuOpen, setMenuOpen] = useState(false);
  const signedOut = account.user === null;

  return (
    <header className="border-b border-line bg-surface-raised">
      <PageContainer>
        <MastheadRow>
          <MastheadStart>
            <Logo className="text-logo text-ink md:text-masthead" />
            <nav aria-label="Main" className="flex items-center gap-6 max-md:hidden">
              <MainLinks user={account.user} />
            </nav>
          </MastheadStart>

          <div className="flex items-center justify-end gap-3 md:gap-4">
            {signedOut && (
              <Link to={forRestaurants.to} className={`${quietLink} max-lg:hidden`}>
                {forRestaurants.label}
              </Link>
            )}
            {/* Sign in stays on phones too. A name and Sign out move into the menu there. */}
            <span className={signedOut ? undefined : "max-md:hidden"}>
              <HeaderAccount account={account} />
            </span>
            <MenuToggle aria-haspopup="dialog" onClick={() => setMenuOpen(true)}>
              Menu
            </MenuToggle>
          </div>
        </MastheadRow>
      </PageContainer>
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} account={account} />
    </header>
  );
}
