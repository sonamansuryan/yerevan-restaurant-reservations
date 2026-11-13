import { cx } from "@/lib/cx";

interface ControlState {
  invalid: boolean;
  disabled: boolean | undefined;
}

/**
 * The shared look of Input, Select, Textarea and PasswordField: a white box with rounded corners.
 * Its line is line-control, dark enough to find the field (§13.6).
 *
 * In focus the line turns wine and doubles. The second line is a ring, which takes no room, so
 * nothing moves, and the usual focus outline is switched off here: outline-hidden still shows one
 * to people using a forced high-contrast mode.
 *
 * Each state sets its own colors instead of adding a class on top. Two classes for the same
 * property don't work as an override, because Tailwind decides which one wins, not the order
 * they're written in here. For the same reason only the left padding is here: each field sets its
 * own right padding, because a Select's arrow and a password's Show need more room.
 *
 * Text is 16px, because iPhones zoom the whole page when a smaller field gets focus.
 */
export function controlClass({ invalid, disabled }: ControlState): string {
  const base =
    "w-full rounded-card border pl-3.5 text-body outline-hidden transition-[border-color,box-shadow] duration-150";

  if (disabled)
    return cx(
      base,
      "cursor-not-allowed border-dashed border-line-control bg-fill-hover text-ink-muted",
    );
  if (invalid)
    return cx(base, "border-error bg-surface-raised text-ink focus:ring-1 focus:ring-error");
  return cx(
    base,
    "border-line-control bg-surface-raised text-ink hover:border-ink focus:border-accent focus:ring-1 focus:ring-accent",
  );
}
