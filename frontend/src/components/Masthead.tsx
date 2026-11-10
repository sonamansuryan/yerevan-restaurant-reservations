import type { ComponentProps, ReactElement, ReactNode } from "react";

/**
 * The top row of a page, with the double rule beneath it: the logo and the way around the site
 * together on the left, and the actions on the right. The mobile menu repeats this row, so the
 * logo and the words Menu and Close stay put when the menu opens.
 */
export function MastheadRow({ children }: { children: ReactNode }): ReactElement {
  return (
    <div className="flex h-header-sm items-center justify-between gap-4 border-b-3 border-double border-line-rule md:h-header md:gap-6">
      {children}
    </div>
  );
}

/**
 * The left of the row: the logo, then the links or the word Menu. Their words share a baseline, as
 * on a printed masthead, whatever their sizes. The menu uses this too, so Close lands where Menu was.
 */
export function MastheadStart({ children }: { children: ReactNode }): ReactElement {
  return <div className="flex items-baseline gap-4 md:gap-10">{children}</div>;
}

/**
 * The words Menu and Close, in the same spot. A word is clearer than an icon, and suits a restaurant.
 * The padding keeps the tap area 44px or more around the word.
 */
export function MenuToggle(props: ComponentProps<"button">): ReactElement {
  return (
    <button
      {...props}
      type="button"
      className="inline-flex min-h-touch items-center px-2 font-display text-title-xs text-ink md:hidden"
    />
  );
}
