import type { ComponentProps, ReactElement } from "react";

import { cx } from "@/lib/cx";

interface SlotButtonProps extends ComponentProps<"button"> {
  /** The chosen one, which screen readers hear as pressed. */
  selected?: boolean;
}

/**
 * A time to choose, such as 19:30, in a hairline outline that fills with ink once chosen. A time
 * that can't be chosen keeps its place, struck through, so the times around it don't move.
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
        "min-h-touch rounded-slot border px-3 text-ui tabular-nums transition-[border-color,background-color,color] duration-150",
        selected && "border-ink bg-ink text-on-dark",
        !selected && disabled && "cursor-not-allowed border-line text-ink-muted line-through",
        !selected &&
          !disabled &&
          "border-line-control text-ink hover:border-ink active:bg-line-soft",
        className,
      )}
    />
  );
}
