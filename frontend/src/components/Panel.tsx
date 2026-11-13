import type { ComponentProps, ReactElement, ReactNode } from "react";

import { cx } from "@/lib/cx";

interface PanelProps extends Omit<ComponentProps<"section">, "title"> {
  /** The panel's heading, if it has one. */
  title?: string;
  /** The heading's level: 3 under a part of a page, 4 inside /design's specimens. */
  headingLevel?: 2 | 3 | 4;
  /** Beside the heading, such as a count or a small button. */
  aside?: ReactNode;
  /**
   * For a list that runs edge to edge: the title gets its own row on a hairline, and the content
   * has no padding of its own, so each line can carry its own.
   */
  flush?: boolean;
}

/**
 * A white card with a soft line around it: how the dashboard and the admin area hold each part of a
 * page, such as a form's section or a list. It's a plain section, not a landmark, so a page of them
 * doesn't crowd a screen reader's list of regions: its heading is how people find it.
 */
export function Panel({
  title,
  headingLevel = 3,
  aside,
  flush = false,
  className,
  children,
  ...rest
}: PanelProps): ReactElement {
  const Heading = headingLevel === 2 ? "h2" : headingLevel === 3 ? "h3" : "h4";
  return (
    <section
      {...rest}
      className={cx("min-w-0 rounded-band border border-line bg-surface-raised", className)}
    >
      {title && (
        <div
          className={cx(
            "flex flex-wrap items-center justify-between gap-x-4 gap-y-2",
            flush ? "border-b border-line px-5 py-4" : "px-5 pt-5",
          )}
        >
          <Heading className="text-body font-semibold">{title}</Heading>
          {aside}
        </div>
      )}
      <div className={flush ? undefined : cx("px-5 pb-5", title ? "pt-4" : "pt-5")}>{children}</div>
    </section>
  );
}
