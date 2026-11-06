import { useId } from "react";
import type { ComponentProps, ReactElement, ReactNode } from "react";

import { FieldError } from "@/components/Field";
import { CheckIcon } from "@/components/icons";
import { cx } from "@/lib/cx";

interface CheckboxProps extends Omit<ComponentProps<"input">, "type"> {
  label: ReactNode;
  error?: string;
}

function boxClass(invalid: boolean, disabled: boolean | undefined): string {
  const base =
    "block size-4.5 appearance-none rounded-check border transition-[background-color,border-color] duration-150";

  if (disabled) {
    return cx(base, "cursor-not-allowed border-line-strong checked:bg-line-strong");
  }
  if (invalid) {
    return cx(base, "cursor-pointer border-error checked:bg-error");
  }
  return cx(
    base,
    "cursor-pointer border-line-control hover:border-ink checked:border-accent checked:bg-accent checked:hover:border-accent-hover checked:hover:bg-accent-hover",
  );
}

/**
 * A real checkbox with its default look removed, so Space and screen readers still work. The label
 * wraps it, so the whole row can be tapped, and that row is at least 44px tall on phones. The check
 * mark sits right after the input, because index.css draws it from `input:checked + .check-mark`.
 */
export function Checkbox({
  id,
  label,
  error,
  disabled,
  className,
  ...rest
}: CheckboxProps): ReactElement {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const errorId = error ? `${controlId}-error` : undefined;

  return (
    <div className={cx("flex flex-col", className)}>
      <label
        className={cx(
          "flex min-h-touch items-center gap-2.5 text-ui md:min-h-0",
          disabled ? "cursor-not-allowed text-ink-muted" : "cursor-pointer text-ink",
        )}
      >
        <span className="relative size-4.5 flex-none">
          <input
            {...rest}
            id={controlId}
            type="checkbox"
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={errorId}
            className={boxClass(Boolean(error), disabled)}
          />
          <CheckIcon
            width="14"
            height="14"
            strokeWidth="2.2"
            className={cx(
              "check-mark pointer-events-none absolute top-0.5 left-0.5",
              disabled ? "text-ink-muted" : "text-on-accent",
            )}
          />
        </span>
        {label}
      </label>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}
