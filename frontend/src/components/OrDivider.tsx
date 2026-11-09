import type { ComponentProps, ReactElement } from "react";

import { cx } from "@/lib/cx";

/** Between two ways of doing the same thing, such as a form and Google's button. */
export function OrDivider({ className, ...rest }: ComponentProps<"p">): ReactElement {
  return (
    <p
      {...rest}
      className={cx(
        "flex items-center gap-4 font-display text-title-xs text-ink-muted italic",
        className,
      )}
    >
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
      or
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
    </p>
  );
}
