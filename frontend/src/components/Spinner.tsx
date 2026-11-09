import type { ReactElement } from "react";

import { cx } from "@/lib/cx";

interface SpinnerProps {
  /** Read out by screen readers. Pass null when nearby text already says what's happening. */
  label?: string | null;
  className?: string;
}

/** Page-level loading: the dot from the seghan logo, gently breathing. Buttons have their own ring. */
export function Spinner({ label = "Loading", className }: SpinnerProps): ReactElement {
  return (
    <span
      role={label ? "status" : undefined}
      aria-label={label ?? undefined}
      aria-hidden={label ? undefined : true}
      className={cx(
        "inline-block size-2 animate-breathe rounded-pill bg-accent motion-reduce:animate-none",
        className,
      )}
    />
  );
}
