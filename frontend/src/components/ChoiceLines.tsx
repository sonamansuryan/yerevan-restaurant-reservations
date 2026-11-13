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
  /** The choice made at first, when no form library is choosing it. */
  defaultChoice?: string;
  error?: string;
}

/**
 * One choice in its box, for a radio inside a label: a white box that turns wine once its radio is
 * chosen, its line doubling as a field's does in focus.
 */
export const choiceBoxClass =
  "flex min-h-touch cursor-pointer items-center gap-3 rounded-hero border border-line bg-surface-raised px-3.5 py-3 transition-[border-color,box-shadow] duration-150 hover:border-ink has-checked:border-accent has-checked:ring-1 has-checked:ring-accent";

/**
 * A real radio group, each choice in its own box: a ring with a wine dot inside once chosen,
 * the name, and a note at the end. Being real radios, the arrow keys move between the choices and
 * screen readers announce a group. The other props, such as register("role"), go to every radio,
 * which is how a radio group works.
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
      <legend className="mb-2 text-ui font-semibold text-ink">{legend}</legend>
      <div className="flex flex-col gap-2">
        {options.map((option) => (
          <label key={option.value} className={choiceBoxClass}>
            <ChoiceRadio
              {...rest}
              value={option.value}
              defaultChecked={
                defaultChoice === undefined ? undefined : option.value === defaultChoice
              }
              aria-invalid={error ? true : undefined}
            />
            <span className="text-ui font-semibold text-ink">{option.label}</span>{" "}
            <span className="ml-auto text-meta text-ink-muted">{option.note}</span>
          </label>
        ))}
      </div>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </fieldset>
  );
}

/** One radio of a choice: a ring, with a wine dot inside once it's chosen. */
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
