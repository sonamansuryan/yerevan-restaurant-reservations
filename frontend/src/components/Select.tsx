import type { ComponentProps, ReactElement } from "react";

import { Field } from "@/components/Field";
import { controlClass } from "@/components/field-styles";
import { ChevronDownIcon } from "@/components/icons";
import { cx } from "@/lib/cx";

interface SelectProps extends ComponentProps<"select"> {
  label: string;
  hint?: string;
  error?: string;
}

/**
 * A real <select> under a custom arrow. Keeping the native element means keyboards work and
 * phones show their own picker. The arrow ignores clicks, so they reach the select below it.
 */
export function Select({
  id,
  label,
  hint,
  error,
  disabled,
  className,
  children,
  ...rest
}: SelectProps): ReactElement {
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
        <div className="relative">
          <select
            {...rest}
            {...control}
            disabled={disabled}
            className={cx(
              "h-11 appearance-none pr-7",
              controlClass({ invalid: Boolean(error), disabled }),
            )}
          >
            {children}
          </select>
          <ChevronDownIcon
            strokeWidth="1.6"
            className="pointer-events-none absolute top-1/2 right-0 -translate-y-1/2 text-ink-muted"
          />
        </div>
      )}
    </Field>
  );
}
