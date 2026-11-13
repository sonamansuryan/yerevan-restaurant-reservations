import type { ComponentProps, MouseEvent, ReactElement } from "react";
import { Link } from "react-router";

import { ArrowRightIcon } from "@/components/icons";
import { cx } from "@/lib/cx";

export type ButtonVariant =
  "primary" | "accent" | "ghost" | "danger" | "success" | "light" | "link";

/** "classic" is only for EmptyState and ErrorState, which keep their approved look (§13.7). */
export type ButtonLook = "default" | "classic";

/**
 * "default" is 44px tall. "large" is the page's one big action, such as booking or signing in.
 * "small" sits inside a card, and "compact" in a row of a list, such as a day's bookings: 38px and
 * 36px, as in the export, and 44px wherever there's a touch screen, to tap.
 */
export type ButtonSize = "default" | "large" | "small" | "compact";

interface ButtonProps extends ComponentProps<"button"> {
  variant?: ButtonVariant;
  look?: ButtonLook;
  size?: ButtonSize;
  /** Shows a spinner and ignores clicks, while the button keeps its size and keyboard focus. */
  loading?: boolean;
  /** Adds an arrow that nudges on hover. Meant for the link variant. */
  arrow?: boolean;
}

interface LinkButtonProps extends ComponentProps<typeof Link> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

// Soft corners and a bold label, as in the export. Only the listed properties animate:
// `transition-colors` would also animate outline-color, which makes the focus ring fade in from the
// text color instead of appearing at once.
const base =
  "relative inline-flex items-center justify-center gap-2 border font-semibold whitespace-nowrap transition-[background-color,border-color,color,translate] duration-button";

const sizes: Record<ButtonSize, string> = {
  default: "h-11 rounded-control px-5 text-ui",
  large: "h-13 rounded-cta px-6 text-body",
  small: "h-9.5 rounded-control px-4 text-ui any-pointer-coarse:h-11",
  compact: "h-9 rounded-chip px-3 text-meta any-pointer-coarse:h-11",
};

// An outline button is white, with a soft line: its words say what it does, so the line doesn't
// have to stand out the way a field's does (§13.6). Cancelling and removing are outlines in wine,
// so they're never mistaken for the way forward.
const variants: Record<Exclude<ButtonVariant, "link">, string> = {
  primary:
    "border-transparent bg-ink text-on-dark hover:bg-fill-primary-hover active:translate-y-px",
  accent: "border-transparent bg-accent text-on-accent hover:bg-accent-hover active:translate-y-px",
  ghost: "border-line-strong bg-surface-raised text-ink hover:border-ink active:translate-y-px",
  danger:
    "border-line-danger bg-surface-raised text-accent hover:border-accent active:translate-y-px",
  success:
    "border-transparent bg-success-strong text-on-accent hover:bg-success active:translate-y-px",
  light:
    "border-transparent bg-surface-page text-ink hover:bg-surface-raised active:translate-y-px",
};

const disabledStyle = "cursor-not-allowed border-transparent bg-fill-disabled text-ink-muted";

// A link's look: wine and underlined, as the export sets every link. It's at least 44px tall on
// phones, even though it looks like plain text.
const linkBase =
  "group relative inline-flex min-h-touch items-center justify-center gap-1.5 text-ui font-semibold underline underline-offset-4 transition-[color,text-decoration-color] duration-button md:min-h-0";
const linkEnabled =
  "text-accent decoration-accent/40 hover:text-accent-hover hover:decoration-current";
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
  look: ButtonLook,
  size: ButtonSize,
  disabled: boolean,
): string {
  if (look === "classic") {
    return cx(
      classicBase,
      disabled ? disabledStyle : classicVariants[variant === "ghost" ? "ghost" : "primary"],
    );
  }
  if (variant === "link") return cx(linkBase, disabled ? linkDisabled : linkEnabled);
  return cx(base, sizes[size], disabled ? disabledStyle : variants[variant]);
}

export function Button({
  variant = "primary",
  look = "default",
  size = "default",
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
      className={cx(buttonClass(variant, look, size, disabled), className)}
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
  size = "default",
  className,
  ...rest
}: LinkButtonProps): ReactElement {
  return <Link {...rest} className={cx(buttonClass(variant, "default", size, false), className)} />;
}
