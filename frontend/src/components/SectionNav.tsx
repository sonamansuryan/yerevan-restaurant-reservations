import type { ComponentProps, ReactElement } from "react";
import { NavLink } from "react-router";
import type { To } from "react-router";

import { CurrentPageDot } from "@/components/Logo";
import { cx } from "@/lib/cx";

export interface SectionLink {
  to: To;
  label: string;
  /** Only its exact address marks it, for a part that lives at its parent's own address. */
  end?: boolean;
}

interface SectionNavProps extends ComponentProps<"nav"> {
  /** What screen readers call these links, such as "Lori Smokehouse". */
  label: string;
  links: SectionLink[];
}

/**
 * The parts of one place, as serif links in a row on a hairline, in the header's own style: the
 * part you're on is in ink and carries the logo's dot. On a phone the row wraps onto a second line.
 */
export function SectionNav({ label, links, className, ...rest }: SectionNavProps): ReactElement {
  return (
    <nav aria-label={label} className={cx("border-b border-line", className)} {...rest}>
      <ul className="flex flex-wrap gap-x-6 sm:gap-x-8">
        {links.map((link) => (
          <li key={link.label}>
            {/* NavLink marks the link to the page you're on with aria-current="page". */}
            <NavLink
              to={link.to}
              end={link.end}
              className="group inline-flex min-h-touch items-center font-display text-title-xs text-ink-secondary transition-[color] duration-button hover:text-ink aria-[current=page]:text-ink"
            >
              <span className="inline-flex items-baseline gap-1">
                <span className="underline decoration-transparent decoration-1 underline-offset-4 transition-[text-decoration-color] duration-button group-hover:decoration-ink">
                  {link.label}
                </span>
                <CurrentPageDot />
              </span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
