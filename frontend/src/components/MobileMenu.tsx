import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import { Link, NavLink } from "react-router";

import type { Account } from "@/components/account";
import { LinkButton } from "@/components/Button";
import { CurrentPageDot, Logo } from "@/components/Logo";
import { MastheadRow, MastheadStart, MenuToggle } from "@/components/Masthead";
import { PageContainer } from "@/components/PageContainer";
import { discover, districts, mainLinks, signIn } from "@/components/site-links";
import type { SiteLink } from "@/components/site-links";

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
  account: Account;
}

// One line of the menu: a name, the dotted line, and a note.
const menuLine = "group flex min-h-16 items-baseline gap-2 py-4";

function MenuLine({ link, onClose }: { link: SiteLink; onClose: () => void }): ReactElement {
  return (
    <li>
      <NavLink
        to={link.to}
        onClick={onClose}
        aria-current={link.marksPage === false ? "false" : "page"}
        className={menuLine}
      >
        <span className="inline-flex items-baseline gap-1 font-display text-logo-sm">
          {link.label}
          <CurrentPageDot />
        </span>{" "}
        {/* The space above keeps the two parts apart when a screen reader reads the link out. */}
        <span aria-hidden="true" className="menu-leader" />
        <span className="text-meta text-ink-muted">{link.note}</span>
      </NavLink>
    </li>
  );
}

/**
 * The menu's last line: Sign in, or Sign out with the person's name where the note goes. While the
 * app is still asking who's signed in, the line waits, rather than show the wrong one.
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
      {/* Only the words Sign out are the button, so a tap on the name signs nobody out. The
          padding makes the tap area 44px or more without moving the line. */}
      <button
        type="button"
        onClick={signingOut ? undefined : onSignOut}
        aria-busy={signingOut || undefined}
        aria-disabled={signingOut || undefined}
        className="-my-3 shrink-0 py-3 font-display text-logo-sm whitespace-nowrap aria-busy:text-ink-muted"
      >
        Sign out
      </button>{" "}
      <span aria-hidden="true" className="menu-leader" />
      {signOutFailed ? (
        <span role="alert" className="text-meta text-error">
          Couldn&rsquo;t sign out. Try again.
        </span>
      ) : (
        <span className="min-w-0 truncate text-meta text-ink-muted">
          <span className="sr-only">Signed in as </span>
          {user.name}
        </span>
      )}
    </li>
  );
}

/**
 * The menu on phones, set like a printed menu. It's built on the native <dialog>, like Modal:
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
        <PageContainer>
          {/* The same left side as the header, so Close lands exactly where Menu was. */}
          <MastheadRow>
            <MastheadStart>
              <Logo className="text-logo" onClick={onClose} />
              <MenuToggle onClick={onClose}>Close</MenuToggle>
            </MastheadStart>
          </MastheadRow>
        </PageContainer>

        <PageContainer className="menu-sheet-list flex flex-1 flex-col pt-4 pb-6">
          <nav aria-label="Main">
            <ul>
              {mainLinks(account.user).map((link) => (
                <MenuLine key={link.to} link={link} onClose={onClose} />
              ))}
              <MenuAccountLine account={account} onClose={onClose} />
            </ul>
          </nav>

          <nav aria-labelledby="menu-neighborhoods" className="mt-6">
            <h2 id="menu-neighborhoods" className="text-eyebrow text-ink-muted uppercase">
              Neighborhoods
            </h2>
            <ul className="mt-1 grid grid-cols-2 gap-x-4">
              {districts.map((district) => (
                <li key={district.to}>
                  <Link
                    to={district.to}
                    onClick={onClose}
                    className="flex min-h-touch items-center text-body text-ink-secondary"
                  >
                    {district.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Pushed to the bottom, within reach of a thumb. */}
          <div className="mt-auto pt-10">
            <p className="mb-4 text-center font-display text-title">
              See you at the <em className="text-accent">table.</em>
            </p>
            <LinkButton to={discover.to} onClick={onClose} className="w-full">
              Reserve a table
            </LinkButton>
          </div>
        </PageContainer>
      </div>
    </dialog>
  );
}
