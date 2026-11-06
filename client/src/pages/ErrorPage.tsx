import type { ReactElement } from "react";

import { LinkButton } from "@/components/Button";
import { ErrorState } from "@/components/ErrorState";
import { PageContainer } from "@/components/PageContainer";

/**
 * Shown when a page crashes. It uses the protected ErrorState as it is, and passes in only the
 * words (PROJECT_PLAN.md §13.7). There's no humor here, as someone may be in the middle of a booking.
 */
export function ErrorPage(): ReactElement {
  return (
    <PageContainer className="flex flex-col items-center gap-6 py-section-sm md:py-section-lg">
      <title>Something went wrong · Seghan</title>
      <h1 className="sr-only">Something went wrong</h1>
      <ErrorState
        title="Our apologies"
        description="Something went wrong on our side."
        onRetry={() => window.location.reload()}
        className="w-full max-w-120"
      />
      {/* A full page load, because whatever broke may still be in memory. */}
      <LinkButton to="/" variant="link" reloadDocument>
        Back to the home page
      </LinkButton>
    </PageContainer>
  );
}
