import { useId } from "react";
import type { ComponentProps, ReactElement } from "react";

import { FieldError } from "@/components/Field";
import { cx } from "@/lib/cx";

export interface ChoiceOption {
  value: string;
  label: string;
  note: string;
}

interface ChoiceLinesProps extends Omit<ComponentProps<"input">, "type" | "defaultValue"> {
  legend: string;
  options: ChoiceOption[];
  /** The line chosen at first, when no form library is choosing it. */
  defaultChoice?: string;
  error?: string;
}

/**
 * A real radio group, set as menu lines: a ring with the logo's dot inside, the name in serif, a
 * dotted line and a note. Being real radios, the arrow keys move between the lines and screen
 * readers announce a group. Phones drop the dotted line, which would only squeeze the words. The
 * other props, such as register("role"), go to every radio, which is how a radio group works.
 */
export function ChoiceLines({
  legend,
  options,
  defaultChoice,
  error,
  className,
  ...rest
}: ChoiceLinesProps): ReactElement {
  const errorId = useId();

  return (
    <fieldset
      aria-describedby={error ? errorId : undefined}
      className={cx("flex min-w-0 flex-col", className)}
    >
      <legend className="text-meta font-medium text-ink-secondary">{legend}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className="flex min-h-touch cursor-pointer items-baseline gap-3 border-b border-line py-3"
        >
          <ChoiceRadio
            {...rest}
            value={option.value}
            defaultChecked={
              defaultChoice === undefined ? undefined : option.value === defaultChoice
            }
            aria-invalid={error ? true : undefined}
          />
          <span className="font-display text-title-xs text-ink">{option.label}</span>{" "}
          <span aria-hidden="true" className="menu-leader max-sm:hidden" />
          <span className="text-meta text-ink-muted max-sm:ml-auto">{option.note}</span>
        </label>
      ))}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </fieldset>
  );
}

/** One radio of a line: a ring, with the logo's dot inside once it's chosen. */
export function ChoiceRadio(props: Omit<ComponentProps<"input">, "type">): ReactElement {
  return (
    <span className="relative size-4 flex-none self-center">
      <input
        {...props}
        type="radio"
        className="peer absolute inset-0 cursor-pointer appearance-none rounded-pill border border-line-control transition-[border-color] duration-150 checked:border-accent hover:border-ink checked:hover:border-accent-hover"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-1 rounded-pill bg-accent opacity-0 peer-checked:opacity-100"
      />
    </span>
  );
}
