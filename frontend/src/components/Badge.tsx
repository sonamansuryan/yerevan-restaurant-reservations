import type { ReactElement, ReactNode } from "react";

import { cx } from "@/lib/cx";

export type BadgeTone = "neutral" | "success" | "warning" | "error" | "info";

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

const dots: Record<BadgeTone, string> = {
  neutral: "bg-ink-muted",
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-error",
  info: "bg-info",
};

/**
 * A status, marked like a note in the margin of a reservation book: a small dot and a word. The
 * dot echoes the one in the logo. The word carries the meaning, so color is never the only signal.
 */
export function Badge({ tone = "neutral", children, className }: BadgeProps): ReactElement {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 text-meta font-medium text-ink-secondary",
        className,
      )}
    >
      <span aria-hidden="true" className={cx("size-1.5 rounded-pill", dots[tone])} />
      {children}
    </span>
  );
}
