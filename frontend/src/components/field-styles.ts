import { cx } from "@/lib/cx";

interface ControlState {
  invalid: boolean;
  disabled: boolean | undefined;
}

/**
 * The shared look of Input, Select and Textarea: a ruled line, like a reservation book, with the
 * text starting at the same left edge as its label.
 *
 * The line is the focus style, so the usual ring is switched off here. It turns wine and doubles in
 * weight, and the extra weight is a shadow, so the layout doesn't move. outline-hidden still shows
 * an outline to people using a forced high-contrast mode.
 *
 * Each state sets its own colors instead of adding a class on top. Two classes for the same
 * property don't work as an override, because Tailwind decides which one wins, not the order
 * they're written in here.
 *
 * Text is 16px, because iPhones zoom the whole page when a smaller field gets focus.
 */
export function controlClass({ invalid, disabled }: ControlState): string {
  const base =
    "w-full border-b bg-transparent text-body outline-hidden transition-[border-color,box-shadow] duration-150";

  if (disabled)
    return cx(base, "cursor-not-allowed border-dashed border-line-control text-ink-muted");
  if (invalid) return cx(base, "border-error text-ink focus:shadow-rule-error");
  return cx(
    base,
    "border-line-control text-ink hover:border-ink focus:border-accent focus:shadow-rule-focus",
  );
}
