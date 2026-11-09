import { useState } from "react";
import type { ComponentProps, ReactElement } from "react";

import { Field } from "@/components/Field";
import { controlClass } from "@/components/field-styles";
import { cx } from "@/lib/cx";

interface PasswordFieldProps extends Omit<ComponentProps<"input">, "type"> {
  label: string;
  hint?: string;
  error?: string;
}

/**
 * A password on the ruled line, with Show and Hide at its end. Seeing what you typed replaces the
 * usual "confirm password" field. `ref` and the other props go to the real <input>, so React Hook
 * Form's register() works, as with Input.
 */
export function PasswordField({
  id,
  label,
  hint,
  error,
  disabled,
  className,
  ...rest
}: PasswordFieldProps): ReactElement {
  const [shown, setShown] = useState(false);

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
          <input
            {...rest}
            {...control}
            type={shown ? "text" : "password"}
            disabled={disabled}
            // Room at the end, so a long password never runs under Show.
            className={cx("h-11 pr-14", controlClass({ invalid: Boolean(error), disabled }))}
          />
          <button
            type="button"
            onClick={() => setShown(!shown)}
            disabled={disabled}
            aria-controls={control.id}
            // Screen readers hear what it's for. The name starts with the word on screen, so voice
            // control users can say "Show" too.
            aria-label={shown ? "Hide password" : "Show password"}
            className="absolute right-0 bottom-0 flex h-11 items-center text-meta font-medium text-ink-secondary underline decoration-line-control underline-offset-4 transition-[color,text-decoration-color] duration-button hover:text-ink hover:decoration-ink disabled:cursor-not-allowed disabled:text-ink-muted"
          >
            {shown ? "Hide" : "Show"}
          </button>
        </div>
      )}
    </Field>
  );
}
