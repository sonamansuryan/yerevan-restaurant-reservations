import type { ReactElement, ReactNode } from "react";

import { cx } from "@/lib/cx";

export type BadgeTone = "neutral" | "success" | "warning" | "error" | "info";

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

// Each status color passes 4.5:1 on its own soft fill (index.css).
const tones: Record<BadgeTone, string> = {
  neutral: "bg-neutral-soft text-ink-secondary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  error: "bg-error-soft text-error",
  info: "bg-info-soft text-info",
};

/**
 * A status as a small pill: a word on its tone's soft fill. The word carries the meaning, so color
 * is never the only signal.
 */
export function Badge({ tone = "neutral", children, className }: BadgeProps): ReactElement {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-pill px-2.5 py-1 text-caption font-semibold whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
