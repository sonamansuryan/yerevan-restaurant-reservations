import type { ComponentProps, MouseEvent, ReactElement } from "react";

import { HeartIcon } from "@/components/icons";
import { cx } from "@/lib/cx";

interface SaveButtonProps extends Omit<ComponentProps<"button">, "children" | "type"> {
  /** Whether it's saved now. Screen readers hear this as pressed or not. */
  saved: boolean;
  /** What's saved, read out after the label, so the buttons in a list are told apart. */
  name: string;
  /** True while the change is sent: the button keeps its place and focus, and ignores clicks. */
  loading?: boolean;
}

/** The toggle's white pill, which "Sign in to save" shares, so the two look alike (SaveRestaurant). */
export const savePillClass =
  "inline-flex min-h-touch items-center gap-2 rounded-pill border border-line bg-surface-raised px-4 text-ui font-semibold text-ink transition-[border-color] duration-150 hover:border-ink";

/**
 * Saves something to the guest's favorites, or takes it out: a white pill with a heart, that says
 * Save, or Saved once it is, with the heart filled in wine. While the change is sent, a ring turns
 * in the heart's place, as a button's spinner does.
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
      className={cx(savePillClass, loading && "cursor-progress", className)}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="size-4 flex-none animate-spin rounded-pill border-[1.5px] border-current border-r-transparent motion-reduce:[animation-duration:3s]"
        />
      ) : (
        <HeartIcon
          className={cx("flex-none", saved && "text-accent")}
          fill={saved ? "currentColor" : "none"}
        />
      )}
      {label}
    </button>
  );
}
