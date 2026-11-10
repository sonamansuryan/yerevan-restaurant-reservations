import type { ReactElement, ReactNode } from "react";

import { cx } from "@/lib/cx";

interface FormPartProps {
  title: string;
  /** 3 on a dashboard page, under the restaurant's name and its part. 4 in /design's specimens. */
  headingLevel?: 3 | 4;
  className?: string;
  children: ReactNode;
}

/**
 * One part of a long form, such as "Location and contact": a serif title on a hairline, as the
 * restaurant page titles its parts, with the fields below.
 */
export function FormPart({
  title,
  headingLevel = 3,
  className,
  children,
}: FormPartProps): ReactElement {
  const Heading = headingLevel === 3 ? "h3" : "h4";
  return (
    <section className={cx("flex flex-col gap-6", className)}>
      <Heading className="border-t border-line pt-5 font-display text-title-sm">{title}</Heading>
      {children}
    </section>
  );
}
