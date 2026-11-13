import type { ComponentProps, ReactElement } from "react";

import { cx } from "@/lib/cx";

interface SlotButtonProps extends ComponentProps<"button"> {
  /** The chosen one, which screen readers hear as pressed. */
  selected?: boolean;
}

/**
 * A time to choose, such as 19:30: a white box that fills with wine once chosen, wine being the
 * guest pages' color for booking. A time that can't be chosen keeps its place, dashed and struck
 * through, so the times around it don't move.
 */
export function SlotButton({
  selected = false,
  disabled,
  className,
  ...rest
}: SlotButtonProps): ReactElement {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled}
      aria-pressed={selected}
      className={cx(
        "min-h-touch rounded-card border px-3 text-ui font-semibold tabular-nums transition-[border-color,background-color,color] duration-150",
        selected && "border-accent bg-accent text-on-accent",
        !selected &&
          disabled &&
          "cursor-not-allowed border-dashed border-line-strong bg-surface-page text-ink-muted line-through",
        !selected &&
          !disabled &&
          "border-line bg-surface-raised text-ink hover:border-ink active:bg-fill-hover",
        className,
      )}
    />
  );
}
