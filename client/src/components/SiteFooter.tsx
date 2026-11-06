import type { ReactElement, ReactNode } from "react";
import { Link } from "react-router";

import { Logo } from "@/components/Logo";
import { PageContainer } from "@/components/PageContainer";
import { districts } from "@/components/site-links";

// Read once, because a component must render the same way each time.
const year = new Date().getFullYear();

function FooterColumn({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <div>
      <h2 className="text-caption font-medium tracking-label text-ink-muted uppercase">{title}</h2>
      <ul className="mt-3 flex flex-col md:gap-1">{children}</ul>
    </div>
  );
}

function FooterLink({ to, children }: { to: string; children: ReactNode }): ReactElement {
  return (
    <li>
      <Link
        to={to}
        className="inline-flex min-h-touch items-center text-ui text-ink-secondary underline decoration-transparent underline-offset-4 transition-[color,text-decoration-color] duration-button hover:text-ink hover:decoration-ink md:min-h-7"
      >
        {children}
      </Link>
    </li>
  );
}

export function SiteFooter(): ReactElement {
  return (
    <footer className="mt-section-sm">
      <PageContainer>
        {/* The same double rule as the header, so a page closes the way it opened. */}
        <div className="grid gap-10 border-t-3 border-double border-line-rule pt-14 pb-12 md:grid-cols-[1fr_2fr] md:gap-8">
          <div>
            <p className="font-display text-section md:max-w-60">
              See you at the <em className="text-accent">table.</em>
            </p>
            <p className="mt-4 max-w-60 text-ui leading-copy text-ink-muted">
              Restaurant reservations across Yerevan.
            </p>
          </div>

          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 md:gap-x-8"
          >
            <FooterColumn title="Explore">
              <FooterLink to="/restaurants">All restaurants</FooterLink>
              {districts.map((district) => (
                <FooterLink key={district.to} to={district.to}>
                  {district.label}
                </FooterLink>
              ))}
            </FooterColumn>
            <FooterColumn title="Your table">
              <FooterLink to="/login">Sign in</FooterLink>
              <FooterLink to="/register">Create an account</FooterLink>
              <FooterLink to="/reservations">My reservations</FooterLink>
            </FooterColumn>
            <FooterColumn title="For restaurants">
              <FooterLink to="/register?role=owner">List your restaurant</FooterLink>
              <FooterLink to="/dashboard">Owner dashboard</FooterLink>
            </FooterColumn>
          </nav>
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1 border-t border-line py-3 text-meta text-ink-muted">
          <span className="inline-flex items-baseline gap-4">
            <Logo className="text-title text-ink" />
            <span>© {year} Seghan</span>
          </span>
          {/* The one place the name appears in Armenian (§1.2). */}
          <span>
            <span lang="hy" className="font-display text-title-xs text-ink">
              սեղան
            </span>
            <span className="ml-2">the Armenian word for table</span>
          </span>
        </div>
      </PageContainer>
    </footer>
  );
}
