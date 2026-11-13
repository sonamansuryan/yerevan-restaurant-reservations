import type { ComponentProps, ReactElement, ReactNode } from "react";

import { cx } from "@/lib/cx";

export interface Bar {
  /** Tells the lines apart. */
  key: string;
  /** What the line counts, such as "Arrived" or a restaurant's name. */
  label: ReactNode;
  value: number;
  /** After the number, in its own column, such as "74%". */
  note?: string;
}

interface BarListProps extends ComponentProps<"ul"> {
  bars: Bar[];
  /** What a full bar stands for: the whole, when the lines are its parts. The largest, unless given. */
  max?: number;
}

const count = new Intl.NumberFormat("en-GB");

/**
 * Counts as thin bars, a line each, like entries in a ledger: the name, a wine bar growing from one
 * baseline, then the number in a column of figures. The bar only pictures the number beside it, so
 * screen readers skip it. On a phone it drops under the name, and it moves into place gently,
 * unless someone asks for less motion.
 */
export function BarList({ bars, max, className, ...rest }: BarListProps): ReactElement {
  const full = max ?? Math.max(0, ...bars.map(({ value }) => value));
  return (
    <ul className={cx("border-t border-line", className)} {...rest}>
      {bars.map((bar) => {
        const share = full > 0 ? Math.min(bar.value / full, 1) : 0;
        return (
          <li
            key={bar.key}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-line py-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto]"
          >
            <span className="min-w-0 text-ui break-words text-ink">{bar.label}</span>
            <span
              aria-hidden="true"
              className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto"
            >
              <span
                className={cx(
                  "block h-1.5 rounded-r-pill bg-accent transition-[width] duration-tile ease-tile motion-reduce:transition-none",
                  // A count too small to see at this scale still shows as a sliver, not as nothing.
                  bar.value > 0 && "min-w-0.5",
                )}
                style={{ width: `${share * 100}%` }}
              />
            </span>
            <span className="text-right text-ui whitespace-nowrap text-ink tabular-nums">
              {count.format(bar.value)}
              {bar.note !== undefined && (
                <span className="ml-3 inline-block w-11 text-ink-muted">{bar.note}</span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
