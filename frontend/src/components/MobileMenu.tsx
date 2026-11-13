import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import { Link, NavLink } from "react-router";

import type { Account } from "@/components/account";
import { LinkButton } from "@/components/Button";
import { ArrowRightIcon } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { MastheadRow, MenuToggle, outlinePill } from "@/components/Masthead";
import { PageContainer } from "@/components/PageContainer";
import {
  districts,
  explore,
  forRestaurants,
  mainLinks,
  offersReserve,
  signIn,
} from "@/components/site-links";
import type { SiteLink } from "@/components/site-links";

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
  account: Account;
}

// One line of the menu: the place in bold, a note under it, and an arrow at the end.
const menuLine = "group flex min-h-18 items-center justify-between gap-4 border-b border-line py-3";

function MenuLine({ link, onClose }: { link: SiteLink; onClose: () => void }): ReactElement {
  return (
    <li>
      <NavLink
        to={link.to}
        onClick={onClose}
        aria-current={link.marksPage === false ? "false" : "page"}
        className={menuLine}
      >
        <span className="flex min-w-0 flex-col">
          <span className="font-grotesque text-subheading font-bold group-aria-[current=page]:text-accent">
            {link.label}
          </span>{" "}
          {/* The space above keeps the two parts apart when a screen reader reads the link out. */}
          <span className="text-meta text-ink-muted">{link.note}</span>
        </span>
        <ArrowRightIcon className="flex-none text-ink-muted" />
      </NavLink>
    </li>
  );
}

/**
 * The menu's last line: Sign in, or the person's name with Sign out. While the app is still asking
 * who's signed in, the line waits, rather than show the wrong one.
 */
export function MenuAccountLine({
  account,
  onClose,
}: {
  account: Account;
  onClose: () => void;
}): ReactElement | null {
  const { user, onSignOut, signingOut, signOutFailed } = account;
  if (user === undefined) return null;
  if (user === null) return <MenuLine link={signIn} onClose={onClose} />;

  return (
    <li className={menuLine}>
      {signOutFailed ? (
        <span role="alert" className="text-meta text-error">
          Couldn&rsquo;t sign out. Try again.
        </span>
      ) : (
        <span className="min-w-0 truncate text-ui text-ink-secondary">
          <span className="sr-only">Signed in as </span>
          {user.name}
        </span>
      )}{" "}
      {/* Only the pill is the button, so a tap on the name signs nobody out. */}
      <button
        type="button"
        onClick={signingOut ? undefined : onSignOut}
        aria-busy={signingOut || undefined}
        aria-disabled={signingOut || undefined}
        className={`${outlinePill} flex-none aria-busy:border-line-strong aria-busy:text-ink-muted`}
      >
        Sign out
      </button>
    </li>
  );
}

/**
 * The menu on phones, as a sheet over the page: the places in bold, For restaurants for anyone
 * signed out, the neighborhoods as pills, and Find a table within reach of a thumb. It's built on the native <dialog>, like Modal:
 * showModal() keeps focus inside, closes on Esc, and returns focus to the Menu button.
 */
export function MobileMenu({ open, onClose, account }: MobileMenuProps): ReactElement {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Signing out from the menu closes it, as following one of its links does. It compares values
  // rather than using a first-render flag, so StrictMode running this twice changes nothing.
  const signedIn = Boolean(account.user);
  const wasSignedIn = useRef(signedIn);
  useEffect(() => {
    if (wasSignedIn.current && !signedIn && open) onClose();
    wasSignedIn.current = signedIn;
  }, [signedIn, open, onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Turning a tablet sideways reveals the full header, and this sheet would be left covering it.
  useEffect(() => {
    if (!open) return;
    const wide = window.matchMedia("(width >= 48rem)");
    function closeIfWide(): void {
      if (wide.matches) onClose();
    }
    wide.addEventListener("change", closeIfWide);
    return () => wide.removeEventListener("change", closeIfWide);
  }, [open, onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-label="Menu"
      onClose={onClose}
      className="menu-sheet m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto bg-surface-page text-ink"
    >
      <div className="flex min-h-full flex-col">
        {/* The same row as the header, so Close lands exactly where Menu was. */}
        <div className="border-b border-line bg-surface-raised">
          <PageContainer>
            <MastheadRow>
              <Logo className="text-logo text-ink" onClick={onClose} />
              <MenuToggle onClick={onClose}>Close</MenuToggle>
            </MastheadRow>
          </PageContainer>
        </div>

        <PageContainer className="menu-sheet-list flex flex-1 flex-col pt-2 pb-6">
          <nav aria-label="Main">
            <ul>
              {mainLinks(account.user).map((link) => (
                <MenuLine key={link.to} link={link} onClose={onClose} />
              ))}
              {/* The header shows it beside Sign in, which phones have no room for. */}
              {account.user === null && <MenuLine link={forRestaurants} onClose={onClose} />}
              <MenuAccountLine account={account} onClose={onClose} />
            </ul>
          </nav>

          <nav aria-labelledby="menu-neighborhoods" className="mt-8">
            <h2 id="menu-neighborhoods" className="text-ui font-semibold text-ink-secondary">
              Neighborhoods
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {districts.map((district) => (
                <li key={district.to}>
                  <Link
                    to={district.to}
                    onClick={onClose}
                    className="inline-flex min-h-touch items-center rounded-pill border border-line-strong bg-surface-raised px-4 text-ui text-ink transition-[border-color] duration-button hover:border-ink"
                  >
                    {district.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Pushed to the bottom, within reach of a thumb. Owners and admins, who never book,
              get the sign-off without the button. */}
          <div className="mt-auto pt-10">
            <p className="text-center font-grotesque text-subheading font-bold">
              See you at the <span className="text-accent">table.</span>
            </p>
            {offersReserve(account.user) && (
              <LinkButton
                variant="accent"
                size="large"
                to={explore.to}
                onClick={onClose}
                className="mt-4 w-full"
              >
                Find a table
              </LinkButton>
            )}
          </div>
        </PageContainer>
      </div>
    </dialog>
  );
}
