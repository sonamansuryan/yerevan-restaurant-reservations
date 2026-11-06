import type { ComponentProps, ReactElement } from "react";

import { Field } from "@/components/Field";
import { controlClass } from "@/components/field-styles";
import { cx } from "@/lib/cx";

interface TextareaProps extends ComponentProps<"textarea"> {
  label: string;
  hint?: string;
  error?: string;
}

/**
 * field-sizing-content grows the box with its text, instead of scrolling inside a small area.
 * Browsers without it use `rows`, so the field still has a sensible height there.
 */
export function Textarea({
  id,
  label,
  hint,
  error,
  disabled,
  className,
  rows = 3,
  ...rest
}: TextareaProps): ReactElement {
  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      disabled={disabled}
      className={className}
    >
      {(control) => (
        <textarea
          {...rest}
          {...control}
          rows={rows}
          disabled={disabled}
          className={cx(
            "block field-sizing-content min-h-11 resize-none py-2",
            controlClass({ invalid: Boolean(error), disabled }),
          )}
        />
      )}
    </Field>
  );
}
