import type { ReactElement } from "react";

import { SectionNav } from "@/components/SectionNav";
import type { SectionLink } from "@/components/SectionNav";

/**
 * The admin area's parts. Restaurants live at its own address, as they're what opens first, and
 * Analytics follows the reservations it counts.
 */
function sectionLinks(base: string): SectionLink[] {
  return [
    { to: base, label: "Restaurants", end: true },
    { to: `${base}/reservations`, label: "Reservations" },
    { to: `${base}/analytics`, label: "Analytics" },
    { to: `${base}/users`, label: "Users" },
  ];
}

interface AdminHeaderProps {
  /** 1 on the page. 4 in /design's specimens, which sit under the page's own headings. */
  headingLevel?: 1 | 4;
  /** For /design: where the parts' links start, so the one at that address shows as open. */
  sectionsBase?: string;
}

/** The top of every part of the admin area: its name in serif, and the row of its parts. */
export function AdminHeader({
  headingLevel = 1,
  sectionsBase = "/admin",
}: AdminHeaderProps): ReactElement {
  const Title = headingLevel === 1 ? "h1" : "h4";
  return (
    <div>
      <Title className="font-display text-section">Admin</Title>
      <SectionNav label="Admin" links={sectionLinks(sectionsBase)} className="mt-8" />
    </div>
  );
}
