import { useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { PageContainer } from "@/components/PageContainer";
import { formatBookDate } from "@/lib/time";

interface OpenBookProps {
  heading: string;
  description: string;
  /** Anything more for the left page, under the description. */
  extra?: ReactNode;
  /** The right page: the form. */
  children: ReactNode;
}

/**
 * The layout of the sign-in pages: an open book. From 1024px, the left page holds today's date,
 * the heading and one sentence, and the right page holds the form, 400px wide to match Google's
 * button. The fold runs down the middle, under the logo, from the header's rule to the footer's:
 * page-fill stretches the book to the footer, and the negative margin reaches across the footer's
 * own margin. Narrower than 1024px, the two pages stack.
 */
export function OpenBook({ heading, description, extra, children }: OpenBookProps): ReactElement {
  // Read once: a page has to render the same way each time.
  const [today] = useState(() => formatBookDate(new Date()));

  return (
    <PageContainer className="page-fill flex flex-col">
      <div className="relative grid flex-1 lg:-mb-section-sm lg:min-h-160 lg:grid-cols-2 lg:before:absolute lg:before:inset-y-0 lg:before:left-1/2 lg:before:w-px lg:before:bg-line-rule">
        <div className="pt-8 pb-10 md:pt-12 lg:py-section-sm lg:pr-16 xl:pr-24">
          <p className="text-eyebrow text-ink-muted uppercase">{today}</p>
          <h1 className="mt-3 font-display text-balance text-hero">{heading}</h1>
          <p className="mt-4 max-w-105 text-lead text-pretty text-ink-secondary">{description}</p>
          {extra}
        </div>
        <div className="lg:py-section-sm lg:pl-16 xl:pl-24">
          <div className="max-w-100">{children}</div>
        </div>
      </div>
    </PageContainer>
  );
}
