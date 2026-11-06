import type { ComponentProps, ReactElement, ReactNode } from "react";

/**
 * The top row of a page, with the double rule beneath it. The two 1fr columns stay equal, which
 * keeps the logo centered whatever sits beside it. The mobile menu repeats this row, so the logo
 * doesn't move when the menu opens.
 */
export function MastheadRow({ children }: { children: ReactNode }): ReactElement {
  return (
    <div className="grid h-header-sm grid-cols-[1fr_auto_1fr] items-center gap-4 border-b-3 border-double border-line-rule md:h-header md:gap-6">
      {children}
    </div>
  );
}

/**
 * The words Menu and Close, in the same spot. A word is clearer than an icon, and suits a restaurant.
 * The negative margin lines the word up with the page while the tap area stays 44px or more.
 */
export function MenuToggle(props: ComponentProps<"button">): ReactElement {
  return (
    <button
      {...props}
      type="button"
      className="-ml-2 inline-flex min-h-touch items-center justify-self-start px-2 font-display text-title-xs text-ink md:hidden"
    />
  );
}
