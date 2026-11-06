import { useId } from "react";
import type { ReactElement, ReactNode } from "react";

import { cx } from "@/lib/cx";

/** What a control needs so that screen readers connect it to its label and messages. */
interface ControlProps {
  id: string;
  "aria-invalid": true | undefined;
  "aria-describedby": string | undefined;
}

interface FieldProps {
  id?: string;
  label: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  /** Receives the attributes for the control, so this wiring exists in one place only. */
  children: (control: ControlProps) => ReactNode;
}

/** The label, hint and error around a control. Input, Select and Textarea all use it. */
export function Field({
  id,
  label,
  hint,
  error,
  disabled,
  className,
  children,
}: FieldProps): ReactElement {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;

  return (
    <div className={cx("flex flex-col gap-0.5", className)}>
      <label
        htmlFor={controlId}
        className={cx("text-meta font-medium", disabled ? "text-ink-muted" : "text-ink-secondary")}
      >
        {label}
      </label>
      {children({
        id: controlId,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": cx(errorId, hintId) || undefined,
      })}
      {hint && (
        <p id={hintId} className="mt-1 text-meta text-ink-muted">
          {hint}
        </p>
      )}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}

interface FieldErrorProps {
  id: string | undefined;
  children: ReactNode;
}

/** The words carry the meaning, so an error never depends on color alone. */
export function FieldError({ id, children }: FieldErrorProps): ReactElement {
  return (
    <p id={id} className="mt-1 text-meta text-error">
      {children}
    </p>
  );
}
