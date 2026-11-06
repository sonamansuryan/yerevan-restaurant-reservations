import { useState } from "react";
import type { ReactElement } from "react";
import { NavLink } from "react-router";

import { LinkButton } from "@/components/Button";
import { CurrentPageDot, Logo } from "@/components/Logo";
import { MastheadRow, MenuToggle } from "@/components/Masthead";
import { MobileMenu } from "@/components/MobileMenu";
import { PageContainer } from "@/components/PageContainer";
import { discover, forRestaurants, signIn } from "@/components/site-links";
import type { SiteLink } from "@/components/site-links";

function MastheadLink({ link }: { link: SiteLink }): ReactElement {
  return (
    <NavLink
      to={link.to}
      aria-current={link.marksPage === false ? "false" : "page"}
      className="group inline-flex min-h-touch items-center font-display text-title-xs text-ink-secondary transition-[color] duration-button hover:text-ink aria-[current=page]:text-ink"
    >
      <span className="inline-flex items-baseline gap-1">
        <span className="underline decoration-transparent decoration-1 underline-offset-4 transition-[text-decoration-color] duration-button group-hover:decoration-ink">
          {link.label}
        </span>
        <CurrentPageDot />
      </span>
    </NavLink>
  );
}

export function SiteHeader(): ReactElement {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header>
      <PageContainer>
        <MastheadRow>
          <nav aria-label="Main" className="flex items-center gap-8 max-md:hidden">
            <MastheadLink link={discover} />
            <MastheadLink link={forRestaurants} />
          </nav>
          <MenuToggle aria-haspopup="dialog" onClick={() => setMenuOpen(true)}>
            Menu
          </MenuToggle>

          <Logo className="text-logo text-ink md:text-masthead" />

          <div className="flex items-center justify-end gap-6">
            <span className="max-md:hidden">
              <MastheadLink link={signIn} />
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
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </header>
  );
}
