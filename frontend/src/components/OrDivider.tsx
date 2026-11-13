import type { ComponentProps, ReactElement } from "react";

import { cx } from "@/lib/cx";

/**
 * Between two ways of doing the same thing, such as Google's button and the form: "or", or longer
 * words such as "or with email".
 */
export function OrDivider({
  className,
  children = "or",
  ...rest
}: ComponentProps<"p">): ReactElement {
  return (
    <p {...rest} className={cx("flex items-center gap-3 text-meta text-ink-muted", className)}>
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
      {children}
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
    </p>
  );
}
