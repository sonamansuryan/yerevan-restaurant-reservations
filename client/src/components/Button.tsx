import type { ComponentProps, MouseEvent, ReactElement } from "react";
import { Link } from "react-router";

import { ArrowRightIcon } from "@/components/icons";
import { cx } from "@/lib/cx";

export type ButtonVariant = "primary" | "accent" | "ghost" | "light" | "link";

interface ButtonProps extends ComponentProps<"button"> {
  variant?: ButtonVariant;
  /** "classic" is only for EmptyState and ErrorState, which keep their approved look (§13.7). */
  look?: "default" | "classic";
  /** Shows a spinner and ignores clicks, while the button keeps its size and keyboard focus. */
  loading?: boolean;
  /** Adds an arrow that nudges on hover. Meant for the link variant. */
  arrow?: boolean;
}

interface LinkButtonProps extends ComponentProps<typeof Link> {
  variant?: ButtonVariant;
}

// Only the listed properties animate. `transition-colors` would also animate outline-color,
// which makes the focus ring fade in from the text color instead of appearing at once.
const base =
  "relative inline-flex h-12 items-center justify-center gap-2 rounded-control border px-6 text-ui font-medium whitespace-nowrap transition-[background-color,border-color,color,translate] duration-button";

const variants: Record<Exclude<ButtonVariant, "link">, string> = {
  primary: "border-transparent bg-ink text-on-dark hover:bg-accent active:translate-y-px",
  accent: "border-transparent bg-accent text-on-accent hover:bg-accent-hover active:translate-y-px",
  ghost: "border-line-control bg-transparent text-ink hover:border-ink active:translate-y-px",
  light:
    "border-transparent bg-surface-page text-ink hover:bg-surface-raised active:translate-y-px",
};

const disabledStyle = "cursor-not-allowed border-transparent bg-fill-slot text-ink-muted";

// A quiet action. It's at least 44px tall on phones, even though it looks like plain text.
const linkBase =
  "group relative inline-flex min-h-touch items-center justify-center gap-1.5 text-ui font-medium underline underline-offset-4 transition-[text-decoration-color] duration-button md:min-h-0";
const linkEnabled = "text-ink decoration-line-control hover:decoration-ink";
const linkDisabled = "cursor-not-allowed text-ink-muted decoration-line-strong";

// EmptyState and ErrorState keep this look on purpose (§13.7), so it doesn't follow the styles
// above. Don't restyle it, and don't use it anywhere else.
const classicBase =
  "relative inline-flex h-11.5 items-center justify-center gap-2 rounded-control border px-5 text-ui font-medium whitespace-nowrap transition-[background-color,border-color,color] duration-button";

const classicVariants = {
  primary:
    "border-transparent bg-ink text-on-dark hover:bg-fill-primary-hover hover:text-surface-raised active:bg-ink-secondary",
  ghost: "border-line-strong bg-transparent text-ink hover:border-ink active:bg-fill-slot",
};

function buttonClass(
  variant: ButtonVariant,
  look: "default" | "classic",
  disabled: boolean,
): string {
  if (look === "classic") {
    return cx(
      classicBase,
      disabled ? disabledStyle : classicVariants[variant === "ghost" ? "ghost" : "primary"],
    );
  }
  if (variant === "link") return cx(linkBase, disabled ? linkDisabled : linkEnabled);
  return cx(base, disabled ? disabledStyle : variants[variant]);
}

export function Button({
  variant = "primary",
  look = "default",
  loading = false,
  arrow = false,
  disabled = false,
  type = "button",
  className,
  children,
  onClick,
  ...rest
}: ButtonProps): ReactElement {
  function handleClick(event: MouseEvent<HTMLButtonElement>): void {
    // aria-disabled doesn't stop clicks by itself. preventDefault also blocks a form submit,
    // including pressing Enter in a field, so a booking can't be sent twice.
    if (loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  return (
    <button
      {...rest}
      type={type}
      disabled={disabled}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={handleClick}
      className={cx(buttonClass(variant, look, disabled), className)}
    >
      {/* The label stays, invisible, so the button keeps its width and its accessible name. */}
      <span className={cx("inline-flex items-center gap-2", loading && "opacity-0")}>
        {children}
      </span>
      {arrow && (
        <ArrowRightIcon
          width="15"
          height="15"
          strokeWidth="1.6"
          className={cx(
            "transition-[translate] duration-button group-hover:translate-x-0.5",
            loading && "opacity-0",
          )}
        />
      )}
      {loading && (
        <span className="absolute inset-0 grid place-items-center">
          <span
            aria-hidden="true"
            className={cx(
              "inline-block size-4.5 animate-spin rounded-pill border-current border-r-transparent motion-reduce:[animation-duration:3s]",
              look === "classic" ? "border-2" : "border-[1.5px]",
            )}
          />
        </span>
      )}
    </button>
  );
}

/** Button's look on a link, for actions that open another page. */
export function LinkButton({
  variant = "primary",
  className,
  ...rest
}: LinkButtonProps): ReactElement {
  return <Link {...rest} className={cx(buttonClass(variant, "default", false), className)} />;
}
