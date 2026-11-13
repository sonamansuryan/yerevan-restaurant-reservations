import type { ComponentProps, ReactElement } from "react";
import { NavLink } from "react-router";
import type { To } from "react-router";

import { cx } from "@/lib/cx";

export interface SectionLink {
  to: To;
  label: string;
  /** Only its exact address marks it, for a part that lives at its parent's own address. */
  end?: boolean;
}

interface SectionNavProps extends ComponentProps<"nav"> {
  /** What screen readers call these links, such as "Your reservations". */
  label: string;
  links: SectionLink[];
}

/**
 * The parts of one page as tabs, such as Upcoming and Past: words in a row on a hairline, the part
 * you're on in ink and underlined on the rule. On a phone the row wraps onto a second line.
 */
export function SectionNav({ label, links, className, ...rest }: SectionNavProps): ReactElement {
  return (
    <nav aria-label={label} className={cx("border-b border-line", className)} {...rest}>
      <ul className="flex flex-wrap gap-x-2">
        {links.map((link) => (
          <li key={link.label}>
            {/* NavLink marks the link to the page you're on with aria-current="page". The 2px line
                overlaps the hairline below it, so the current tab sits on the rule. */}
            <NavLink
              to={link.to}
              end={link.end}
              className="-mb-px inline-flex min-h-12 items-center border-b-2 border-transparent px-4 text-body text-ink-secondary transition-[color,border-color] duration-button hover:text-ink aria-[current=page]:border-ink aria-[current=page]:font-semibold aria-[current=page]:text-ink"
            >
              {link.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
