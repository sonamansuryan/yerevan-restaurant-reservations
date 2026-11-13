import type { ReactElement } from "react";
import { Link } from "react-router";

import { cx } from "@/lib/cx";

/**
 * The brand's mark: a wine square holding a table with a covered dish on it, white, as the export's
 * square holds its S. Seghan is Armenian for table. It's sized in em, so it follows the wordmark
 * beside it. Decorative: the link around the logo has its name.
 */
export function LogoMark({ className }: { className?: string }): ReactElement {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "grid size-[1.55em] flex-none place-items-center rounded-card bg-accent text-on-accent",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-[0.95em]"
      >
        {/* The dish's cover and its knob, the table's top, then its two legs. */}
        <path d="M7.5 11a4.5 4.5 0 0 1 9 0M12 5.5v1" />
        <path d="M3.5 11.5h17" />
        <path d="M6.5 11.5v7.5M17.5 11.5v7.5" />
      </svg>
    </span>
  );
}

interface LogoProps {
  /** Sets the size and color, because the logo appears at several: the mark follows the text. */
  className?: string;
  onClick?: () => void;
}

/**
 * The logo, linking home: the mark, then the wordmark in Bricolage Grotesque, bold and lowercase.
 * It's lowercase only here: text elsewhere says Seghan (§1.2).
 */
export function Logo({ className, onClick }: LogoProps): ReactElement {
  return (
    <Link
      to="/"
      aria-label="Seghan, home"
      onClick={onClick}
      className={cx(
        "inline-flex min-h-touch items-center gap-[0.45em] font-grotesque font-bold",
        className,
      )}
    >
      <LogoMark />
      <span>seghan</span>
    </Link>
  );
}
