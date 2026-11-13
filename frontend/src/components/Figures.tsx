import type { ComponentProps, ReactElement } from "react";

import { cx } from "@/lib/cx";

export interface Figure {
  /** What's counted, such as "Bookings". */
  label: string;
  /** The number as it reads, such as "1,284" or "4.6". */
  value: string;
  /** Read out instead of the value when the value isn't words, such as "None yet" for "–". */
  spoken?: string;
  /** A short line under it, such as "12% of bookings". */
  note?: string;
}

interface FiguresProps extends ComponentProps<"dl"> {
  figures: Figure[];
}

/**
 * Headline numbers side by side, each under a hairline like a column in a ledger: what's counted,
 * the number, and a note. The numbers are in the sans, whose figures read more plainly than the
 * serif's. As many fit in a row as the width allows, two at least.
 */
export function Figures({ figures, className, ...rest }: FiguresProps): ReactElement {
  return (
    <dl
      className={cx(
        "grid grid-cols-[repeat(auto-fit,minmax(min(9rem,40%),1fr))] gap-x-6 gap-y-8",
        className,
      )}
      {...rest}
    >
      {figures.map((figure) => (
        <div key={figure.label} className="min-w-0 border-t border-line-rule pt-3">
          <dt className="text-meta text-ink-secondary">{figure.label}</dt>
          <dd className="mt-2 text-logo font-medium text-ink">
            {figure.spoken ? (
              <>
                <span aria-hidden="true">{figure.value}</span>
                <span className="sr-only">{figure.spoken}</span>
              </>
            ) : (
              figure.value
            )}
          </dd>
          {figure.note && <dd className="mt-1 text-meta text-ink-muted">{figure.note}</dd>}
        </div>
      ))}
    </dl>
  );
}
