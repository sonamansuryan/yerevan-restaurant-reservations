import type { ReactElement } from "react";

import { LinkButton } from "@/components/Button";
import { PageContainer } from "@/components/PageContainer";

export function NotFoundPage(): ReactElement {
  return (
    <PageContainer className="page-fill flex flex-col items-center justify-center py-section-sm text-center md:py-section-lg">
      <title>Page not found · Seghan</title>
      <p className="text-eyebrow text-ink-muted uppercase">404</p>
      <h1 className="mt-4 max-w-140 font-display text-section text-balance md:text-feature">
        Page not found
      </h1>
      <p className="mt-4 max-w-110 text-body text-balance text-ink-secondary">
        The link may be out of date, or the address may have a typo.
      </p>
      <LinkButton to="/" className="mt-10">
        Back to home
      </LinkButton>
    </PageContainer>
  );
}
