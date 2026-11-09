import type { ComponentProps, ReactElement } from "react";

import { Field } from "@/components/Field";
import { controlClass } from "@/components/field-styles";
import { cx } from "@/lib/cx";

interface InputProps extends ComponentProps<"input"> {
  label: string;
  hint?: string;
  error?: string;
}

/** `ref` and the other props go to the real <input>, so React Hook Form's register() works. */
export function Input({
  id,
  label,
  hint,
  error,
  disabled,
  className,
  ...rest
}: InputProps): ReactElement {
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
        <input
          {...rest}
          {...control}
          disabled={disabled}
          className={cx("h-11", controlClass({ invalid: Boolean(error), disabled }))}
        />
      )}
    </Field>
  );
}
