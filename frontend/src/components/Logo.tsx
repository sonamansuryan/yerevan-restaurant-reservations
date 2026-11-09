import type { ReactElement } from "react";
import { Link } from "react-router";

import { cx } from "@/lib/cx";

interface LogoProps {
  /** Sets the size, because the logo appears at several. */
  className?: string;
  onClick?: () => void;
}

/** The wordmark, linking home. It's lowercase only here: text elsewhere says Seghan (§1.2). */
export function Logo({ className, onClick }: LogoProps): ReactElement {
  return (
    <Link
      to="/"
      aria-label="Seghan, home"
      onClick={onClick}
      className={cx("inline-flex min-h-touch items-center font-display", className)}
    >
      <span className="inline-flex items-baseline gap-1.5">
        seghan
        <span aria-hidden="true" className="size-1.5 rounded-pill bg-accent" />
      </span>
    </Link>
  );
}

/**
 * The logo's dot, after a link to the page you're on. The link needs the `group` class. The dot
 * always keeps its space, so nothing moves when it appears.
 */
export function CurrentPageDot(): ReactElement {
  return (
    <span
      aria-hidden="true"
      className="size-1 rounded-pill bg-accent opacity-0 group-aria-[current=page]:opacity-100"
    />
  );
}
