import type { ComponentProps, MouseEvent, ReactElement } from "react";

import { cx } from "@/lib/cx";

interface SaveButtonProps extends Omit<ComponentProps<"button">, "children" | "type"> {
  /** Whether it's saved now. Screen readers hear this as pressed or not. */
  saved: boolean;
  /** What's saved, read out after the label, so the buttons in a list are told apart. */
  name: string;
  /** True while the change is sent: the button keeps its place and focus, and ignores clicks. */
  loading?: boolean;
}

/**
 * Saves something to the guest's favorites, or takes it out: a toggle that says Save, or Saved
 * once it is. The ring takes the logo's dot when saved, the same mark as a chosen line, so a saved
 * restaurant reads as chosen. While the change is sent, the ring turns, as a button's spinner does.
 */
export function SaveButton({
  saved,
  name,
  loading = false,
  className,
  onClick,
  ...rest
}: SaveButtonProps): ReactElement {
  const label = saved ? "Saved" : "Save";

  function handleClick(event: MouseEvent<HTMLButtonElement>): void {
    if (loading) return;
    onClick?.(event);
  }

  return (
    <button
      {...rest}
      type="button"
      // The visible word first, then what it saves, so the buttons in a list are told apart and
      // someone using voice control can say what they see.
      aria-label={`${label} ${name}`}
      aria-pressed={saved}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={handleClick}
      className={cx(
        "group/save relative inline-flex min-h-touch items-center gap-2.5 rounded-control text-ui font-medium text-ink",
        loading && "cursor-progress",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          "relative size-4 flex-none rounded-pill border transition-[border-color] duration-150",
          saved
            ? "border-accent group-hover/save:border-accent-hover"
            : "border-line-control group-hover/save:border-ink",
          loading && "animate-spin border-r-transparent motion-reduce:[animation-duration:3s]",
        )}
      >
        <span
          className={cx(
            "absolute inset-1 rounded-pill bg-accent transition-opacity duration-150",
            saved && !loading ? "opacity-100" : "opacity-0",
          )}
        />
      </span>
      <span className="underline decoration-transparent decoration-1 underline-offset-4 transition-[text-decoration-color] duration-button group-hover/save:decoration-current">
        {label}
      </span>
    </button>
  );
}
