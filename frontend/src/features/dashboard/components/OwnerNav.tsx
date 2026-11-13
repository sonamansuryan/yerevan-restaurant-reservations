import type { ReactElement, ReactNode } from "react";

import { PlusIcon, StoreIcon } from "@/components/icons";
import { SideNav } from "@/components/SideNav";

interface OwnerNavProps {
  /** Who's signed in, with Sign out (OfficeAccount). */
  account?: ReactNode;
  /** For /design: where the links start, so the one at that address shows as open. */
  base?: string;
  /** For /design: a specimen's own height, instead of the window's. */
  specimen?: boolean;
}

/**
 * The owner's dark menu outside any one restaurant: their restaurants, and adding one. It's also
 * what shows while a restaurant's own menu loads. The page's heading is beside it, so this one's
 * name isn't a heading.
 */
export function OwnerNav({ account, base = "/dashboard", specimen }: OwnerNavProps): ReactElement {
  return (
    <SideNav
      label="Owner dashboard"
      links={[
        { to: base, label: "Your restaurants", icon: <StoreIcon />, end: true },
        { to: `${base}/new`, label: "Add a restaurant", icon: <PlusIcon /> },
      ]}
      account={account}
      specimen={specimen}
      header={
        <>
          <p className="text-lead font-semibold">Owner dashboard</p>
          <p className="text-caption text-on-dark-muted">Your restaurants on Seghan</p>
        </>
      }
    />
  );
}
