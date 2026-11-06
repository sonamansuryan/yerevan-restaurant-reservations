import type { ReactElement } from "react";

import { Button } from "@/components/Button";
import { AlertIcon } from "@/components/icons";
import { cx } from "@/lib/cx";

interface ErrorStateProps {
  title?: string;
  description?: string;
  /** Shows a "Try again" button when given. */
  onRetry?: () => void;
  /** True while the retry is running, so the button can show it's working. */
  retrying?: boolean;
  className?: string;
}

/** A protected design: it keeps its approved look on purpose (PROJECT_PLAN.md §13.7). */
export function ErrorState({
  title = "Something went wrong",
  description = "Please try again.",
  onRetry,
  retrying = false,
  className,
}: ErrorStateProps): ReactElement {
  return (
    <div
      role="alert"
      className={cx(
        "state-card flex flex-col items-center gap-2 px-6 py-12 text-center",
        className,
      )}
    >
      <AlertIcon width="28" height="28" className="text-error" />
      <p className="font-display text-title">{title}</p>
      <p className="max-w-70 text-ui text-ink-muted">{description}</p>
      {onRetry && (
        <Button
          look="classic"
          variant="ghost"
          loading={retrying}
          onClick={onRetry}
          className="mt-3"
        >
          Try again
        </Button>
      )}
    </div>
  );
}
