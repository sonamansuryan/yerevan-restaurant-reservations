import type { ComponentProps, ReactElement, ReactNode } from "react";

/**
 * The top row of a page: the logo and the way around the site on the left, the actions on the
 * right. The mobile menu repeats this row, so the logo and the words Menu and Close stay put when
 * the menu opens. The white bar and its line belong to whatever holds the row, so they can run the
 * full width of the window.
 */
export function MastheadRow({ children }: { children: ReactNode }): ReactElement {
  return (
    <div className="flex h-header-sm items-center justify-between gap-4 md:h-header md:gap-6">
      {children}
    </div>
  );
}

/** The left of the row: the logo, then the links, all centered on one line. */
export function MastheadStart({ children }: { children: ReactNode }): ReactElement {
  return <div className="flex items-center gap-4 md:gap-8">{children}</div>;
}

/**
 * The words Menu and Close, in the same spot at the right of the row, as an outline pill. A word is
 * clearer than an icon, and the pill keeps the tap area 44px tall.
 */
export function MenuToggle(props: ComponentProps<"button">): ReactElement {
  return (
    <button
      {...props}
      type="button"
      className="inline-flex h-11 items-center rounded-pill border border-line-strong bg-surface-raised px-4 text-ui font-semibold text-ink transition-[border-color] duration-button hover:border-ink md:hidden"
    />
  );
}

// The header's Sign in: an outline pill in ink, as in the export.
export const outlinePill =
  "inline-flex h-11 items-center justify-center rounded-pill border border-ink px-4.5 text-ui font-semibold whitespace-nowrap text-ink transition-[background-color,border-color,color] duration-button hover:bg-ink hover:text-on-dark";
