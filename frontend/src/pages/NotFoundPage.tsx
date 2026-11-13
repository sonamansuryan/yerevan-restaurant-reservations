import type { ReactElement } from "react";

import { LinkButton } from "@/components/Button";
import { PageContainer } from "@/components/PageContainer";

interface NotFoundPageProps {
  title?: string;
  description?: string;
  /** Where to go instead. */
  action?: { to: string; label: string };
}

/**
 * The approved page for an address with nothing behind it. A restaurant's page passes its own
 * words, so one design covers both.
 */
export function NotFoundPage({
  title = "Page not found",
  description = "The link may be out of date, or the address may have a typo.",
  action = { to: "/", label: "Back to home" },
}: NotFoundPageProps): ReactElement {
  return (
    <PageContainer className="page-fill flex flex-col items-center justify-center py-section-sm text-center md:py-section-lg">
      <title>{`${title} · Seghan`}</title>
      <p className="rounded-pill bg-surface-blush px-3 py-1 text-caption font-semibold text-ink-secondary">
        404
      </p>
      <h1 className="mt-5 max-w-140 font-grotesque text-page-title font-bold text-balance">
        {title}
      </h1>
      <p className="mt-4 max-w-110 text-body text-balance text-ink-secondary">{description}</p>
      <LinkButton to={action.to} className="mt-10">
        {action.label}
      </LinkButton>
    </PageContainer>
  );
}
