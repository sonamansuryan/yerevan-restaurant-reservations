import type { ReactElement, ReactNode } from "react";

import { CalendarIcon, ChartIcon, StoreIcon, UsersIcon } from "@/components/icons";
import { SideNav } from "@/components/SideNav";
import type { SideLink } from "@/components/SideNav";

/**
 * The admin area's parts. Restaurants live at its own address, as they're what opens first, and
 * Analytics follows the reservations it counts.
 */
function sectionLinks(base: string): SideLink[] {
  return [
    { to: base, label: "Restaurants", icon: <StoreIcon />, end: true },
    { to: `${base}/reservations`, label: "Reservations", icon: <CalendarIcon /> },
    { to: `${base}/analytics`, label: "Analytics", icon: <ChartIcon /> },
    { to: `${base}/users`, label: "Users", icon: <UsersIcon /> },
  ];
}

interface AdminNavProps {
  /** Who's signed in, with Sign out (OfficeAccount). */
  account?: ReactNode;
  /** 1 on the page. 4 in /design's specimens, which sit under the page's own headings. */
  headingLevel?: 1 | 4;
  /** For /design: where the parts' links start, so the one at that address shows as open. */
  sectionsBase?: string;
  /** For /design: a specimen's own height, instead of the window's. */
  specimen?: boolean;
}

/** The admin area's menu: the dark menu down the left, as the owner's dashboard has it. */
export function AdminNav({
  account,
  headingLevel = 1,
  sectionsBase = "/admin",
  specimen,
}: AdminNavProps): ReactElement {
  const Title = headingLevel === 1 ? "h1" : "h4";
  return (
    <SideNav
      label="Admin"
      links={sectionLinks(sectionsBase)}
      account={account}
      specimen={specimen}
      header={
        <>
          <Title className="text-lead font-semibold">Admin</Title>
          <p className="text-caption text-on-dark-muted">All of Seghan</p>
        </>
      }
    />
  );
}
