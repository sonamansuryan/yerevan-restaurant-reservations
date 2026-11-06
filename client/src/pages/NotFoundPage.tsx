import type { ReactElement } from "react";

import { LinkButton } from "@/components/Button";
import { PageContainer } from "@/components/PageContainer";
import { discover } from "@/components/site-links";

function BookLine({ time, table, guests }: Record<string, string>): ReactElement {
  return (
    <div className="flex items-baseline gap-4 border-b border-line py-2.5 text-ink-muted">
      <span className="w-12 text-left text-meta">{time}</span>
      <span className="font-display text-title-xs">{table}</span>
      <span className="ml-auto text-meta">{guests}</span>
    </div>
  );
}

export function NotFoundPage(): ReactElement {
  return (
    <PageContainer className="flex flex-col items-center py-section-sm text-center md:py-section-lg">
      <title>Page not found · Seghan</title>
      <p className="text-eyebrow text-ink-muted uppercase">Page not found</p>
      <h1 className="mt-4 max-w-140 font-display text-section text-balance md:text-feature">
        This page isn’t in the book.
      </h1>
      <p className="mt-4 max-w-110 text-body text-balance text-ink-secondary">
        The link may be out of date, or the address may have a typo.
      </p>

      {/* A few lines from the reservation book. They're decoration, so screen readers skip them. */}
      <div
        aria-hidden="true"
        className="mt-10 w-full max-w-md border-t-3 border-double border-line-rule"
      >
        <BookLine time="19:30" table="Table 4" guests="2 guests" />
        <div className="flex items-baseline gap-2 border-b border-line py-2.5 text-accent">
          <span className="w-12 flex-none text-left text-meta">20:00</span>
          <span className="ml-2 font-display text-title-xs">Table 404</span>
          <span className="menu-leader" />
          <span className="text-meta">not in the book</span>
        </div>
        <BookLine time="20:30" table="Table 7" guests="4 guests" />
      </div>

      <div className="mt-10 flex flex-col items-center gap-4 md:flex-row md:gap-6">
        <LinkButton to={discover.to}>Find a table</LinkButton>
        <LinkButton to="/" variant="link">
          Back to the home page
        </LinkButton>
      </div>
    </PageContainer>
  );
}
