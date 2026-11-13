import type { ComponentProps, ReactElement } from "react";

import { ChevronDownIcon } from "@/components/icons";
import { cx } from "@/lib/cx";

export interface PillOption {
  value: string;
  label: string;
}

interface PillSelectProps extends Omit<
  ComponentProps<"select">,
  "value" | "onChange" | "children" | "aria-label"
> {
  /** Shown in the pill before the choice, and the select's name for screen readers. */
  label: string;
  value: string;
  options: PillOption[];
  onChange: (value: string) => void;
  /** A choice that narrows a list: the pill turns ink, so what's filtering it stands out. */
  active?: boolean;
}

/**
 * A choice as a pill, such as "Cuisine Georgian": its label, then what's chosen, then an arrow.
 * The real <select> lies over the whole pill, unseen, so a tap anywhere on it opens the phone's
 * own picker, and keyboards and screen readers use the select as usual. Its name is the label on
 * the pill, so people using voice control can say what they see. Being unseen, the select can't
 * show its own focus ring, so the pill shows it instead.
 */
export function PillSelect({
  label,
  value,
  options,
  onChange,
  active = false,
  className,
  ...rest
}: PillSelectProps): ReactElement {
  const chosen = options.find((option) => option.value === value) ?? options[0];

  return (
    <div
      className={cx(
        "relative inline-flex h-11 max-w-full items-center gap-1.5 rounded-pill border pr-9 pl-4 text-ui transition-[background-color,border-color,color] duration-button has-[select:focus-visible]:outline-2 has-[select:focus-visible]:outline-offset-2 has-[select:focus-visible]:outline-accent",
        active
          ? "border-ink bg-ink text-on-dark"
          : "border-line-strong bg-surface-raised text-ink hover:border-ink",
        className,
      )}
    >
      <span aria-hidden="true" className={active ? "text-on-dark-secondary" : "text-ink-muted"}>
        {label}
      </span>
      <span aria-hidden="true" className="truncate font-semibold">
        {chosen?.label}
      </span>
      <ChevronDownIcon
        strokeWidth="1.6"
        className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2"
      />
      <select
        {...rest}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 cursor-pointer appearance-none rounded-pill opacity-0"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
