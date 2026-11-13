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
 * Headline numbers side by side, each on its own white card: what's counted, the number in bold,
 * and a note. As many fit in a row as the width allows, two at least.
 */
export function Figures({ figures, className, ...rest }: FiguresProps): ReactElement {
  return (
    <dl
      className={cx(
        "grid grid-cols-[repeat(auto-fit,minmax(min(11.25rem,45%),1fr))] gap-3 sm:gap-4",
        className,
      )}
      {...rest}
    >
      {figures.map((figure) => (
        <div
          key={figure.label}
          className="min-w-0 rounded-band border border-line bg-surface-raised px-4.5 py-4"
        >
          <dt className="text-meta font-medium text-ink-secondary">{figure.label}</dt>
          <dd className="mt-1 font-grotesque text-heading font-bold text-ink tabular-nums">
            {figure.spoken ? (
              <>
                <span aria-hidden="true">{figure.value}</span>
                <span className="sr-only">{figure.spoken}</span>
              </>
            ) : (
              figure.value
            )}
          </dd>
          {figure.note && <dd className="mt-1 text-caption text-ink-muted">{figure.note}</dd>}
        </div>
      ))}
    </dl>
  );
}
