import { useEffect, useRef } from "react";
import type { ReactElement, ReactNode } from "react";
import { NavLink, useLocation } from "react-router";
import type { To } from "react-router";

import { Logo } from "@/components/Logo";
import { cx } from "@/lib/cx";

export interface SideLink {
  to: To;
  label: string;
  /** Drawn before the label. Icons are decorative, so screen readers hear only the label. */
  icon: ReactNode;
  /** Only its exact address marks it, for a part that lives at its parent's own address. */
  end?: boolean;
  /** A number to see at a glance, such as the bookings waiting to be confirmed. Hidden at 0. */
  count?: { value: number; label: string };
}

interface SideNavProps {
  /** What screen readers call the links, such as "Lori Smokehouse". */
  label: string;
  links: SideLink[];
  /** Under the logo: whose place this is, such as the restaurant's name and status. */
  header: ReactNode;
  /** Under the links, such as the way to the guests' page. */
  footer?: ReactNode;
  /** Who's signed in, with Sign out (OfficeAccount): at the foot of the menu, or its top on a phone. */
  account?: ReactNode;
  /** For /design: a rounded panel as tall as its links, instead of the window's full height. */
  specimen?: boolean;
  className?: string;
}

/**
 * The dark menu down the left of the owner's dashboard and the admin area, as the export has it: the
 * logo, whose place it is, then its parts as links with icons, the open one lit, and at its foot the
 * way out. From 1024px it runs the window's full height and stays in view as the page scrolls. On a
 * phone it's a dark band above the page, its links in one row that scrolls sideways, so the page
 * itself starts close to the top. NavLink marks the open part with aria-current="page".
 */
export function SideNav({
  label,
  links,
  header,
  footer,
  account,
  specimen = false,
  className,
}: SideNavProps): ReactElement {
  const list = useRef<HTMLUListElement>(null);
  const { pathname } = useLocation();

  // On a phone the row scrolls sideways, so the open part could be out of sight at its end. The row
  // is moved to show it, and only the row: the page itself never scrolls for this.
  useEffect(() => {
    const row = list.current;
    const open = row?.querySelector('[aria-current="page"]');
    if (!row || !open || row.scrollWidth <= row.clientWidth) return;
    const shift = open.getBoundingClientRect().left - row.getBoundingClientRect().left;
    row.scrollLeft += shift - 4;
  }, [pathname]);

  // One copy of each part: on a phone a grid puts who's signed in beside the logo, and from
  // 1024px a column puts it at the foot, after the footer, which takes the spare height.
  return (
    <div
      className={cx(
        "surface-dark grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-5 px-gutter-sm py-4 lg:flex lg:flex-col lg:items-stretch lg:gap-6 lg:px-4 lg:py-5",
        specimen ? "rounded-band" : "lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto",
        className,
      )}
    >
      <Logo className="justify-self-start text-logo-sm text-on-dark lg:mx-2 lg:self-start" />
      {account && <div className={cx("lg:order-last", !footer && "lg:mt-auto")}>{account}</div>}
      <div className="col-span-2 min-w-0 lg:px-2">{header}</div>
      <nav aria-label={label} className="col-span-2 min-w-0">
        {/* The padding keeps a link's focus ring clear of the row's edges, which clip it. */}
        <ul
          ref={list}
          className="-m-1 flex gap-0.5 overflow-x-auto p-1 lg:m-0 lg:flex-col lg:overflow-visible lg:p-0"
        >
          {links.map((link) => (
            <li key={link.label} className="flex-none">
              <NavLink
                to={link.to}
                end={link.end}
                className="flex min-h-touch items-center gap-3 rounded-card px-3 text-ui whitespace-nowrap text-on-dark-secondary transition-[background-color,color] duration-button hover:bg-on-dark/5 hover:text-on-dark aria-[current=page]:bg-surface-dark-raised aria-[current=page]:font-semibold aria-[current=page]:text-on-dark"
              >
                <span className="flex-none">{link.icon}</span>
                {link.label}
                {link.count && link.count.value > 0 && (
                  <span className="ml-auto rounded-pill bg-accent px-2 py-0.5 text-caption font-semibold text-on-accent tabular-nums">
                    <span aria-hidden="true">{link.count.value}</span>
                    {/* Read with the link's name: "Bookings, 3 waiting to be confirmed". */}
                    <span className="sr-only">, {link.count.label}</span>
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      {footer && <div className="col-span-2 flex flex-col gap-4 lg:mt-auto">{footer}</div>}
    </div>
  );
}

/** The outline link at the foot of the dark menu, such as "See the guests' page". */
export const sideNavFootLink =
  "inline-flex min-h-touch items-center gap-1.5 self-start rounded-card border border-line-on-dark px-3 text-ui text-on-dark-secondary transition-[border-color,color] duration-button hover:border-on-dark-secondary hover:text-on-dark lg:self-stretch";
