import type { ReactElement, ReactNode } from "react";

import { cx } from "@/lib/cx";

interface PartHeaderProps {
  title: string;
  /** 2 on a page, under the side menu's name, which is its h1. 4 in /design's specimens. */
  headingLevel?: 2 | 4;
  /** One short line about the part, such as "7 tables, 37 seats". */
  description?: ReactNode;
  /** The part's main action, such as Add a table. */
  action?: ReactNode;
  className?: string;
}

/**
 * The top of one part of the dashboard or the admin area: its name in bold, a line about it, and
 * its main action on the right. On a phone the action drops under the words.
 */
export function PartHeader({
  title,
  headingLevel = 2,
  description,
  action,
  className,
}: PartHeaderProps): ReactElement {
  const Heading = headingLevel === 2 ? "h2" : "h4";
  return (
    <div className={cx("flex flex-wrap items-center justify-between gap-x-6 gap-y-4", className)}>
      <div className="min-w-0">
        <Heading className="font-grotesque text-part font-bold text-balance">{title}</Heading>
        {description && (
          <p className="mt-1 text-input text-pretty text-ink-secondary">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
