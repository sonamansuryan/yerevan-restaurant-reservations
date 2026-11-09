import type { ReactElement } from "react";

import { Button } from "@/components/Button";
import { cx } from "@/lib/cx";

interface EmptyStateProps {
  title: string;
  description?: string;
  /**
   * The one clear next step. It's a label and a handler instead of an element, so a caller can't
   * bring in a button with a different look.
   */
  action?: { label: string; onClick: () => void };
  className?: string;
}

/** A protected design: it keeps its approved look on purpose (PROJECT_PLAN.md §13.7). */
export function EmptyState({
  title,
  description,
  action,
  className,
}: EmptyStateProps): ReactElement {
  return (
    <div
      className={cx(
        "state-card flex flex-col items-center gap-2 px-6 py-12 text-center",
        className,
      )}
    >
      <p className="font-display text-title">{title}</p>
      {description && <p className="max-w-70 text-ui text-ink-muted">{description}</p>}
      {action && (
        <div className="mt-3">
          <Button look="classic" onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}
