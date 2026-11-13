import type { ReactElement, ReactNode } from "react";

/**
 * The frame of the owner's dashboard and the admin area, the back room of the house: the dark menu
 * down the left, the window's full height, and the open part beside it on a warm grey page. On a
 * phone the menu is a band across the top. AppLayout leaves out the site's header and footer here
 * (a route's handle asks for it), as the export's dashboard has none.
 */
export function OfficeLayout({
  nav,
  children,
}: {
  /** The dark menu: RestaurantNav, AdminNav or OwnerNav. */
  nav: ReactNode;
  children: ReactNode;
}): ReactElement {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      {nav}
      {/* min-w-0 keeps a wide table scrolling inside its panel instead of widening the page. */}
      <div className="min-w-0 px-gutter-sm pt-6 pb-section-sm md:px-8 md:pt-8">{children}</div>
    </div>
  );
}
