import type { ReactElement, ReactNode } from "react";
import { Link } from "react-router";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BanIcon,
  CalendarIcon,
  ChartIcon,
  ClockIcon,
  ImageIcon,
  StoreIcon,
  TableIcon,
} from "@/components/icons";
import { SideNav, sideNavFootLink } from "@/components/SideNav";
import type { SideLink } from "@/components/SideNav";
import { PublishedBadge } from "@/features/dashboard/components/PublishedBadge";
import type { OwnerRestaurant } from "@/types/api";

/**
 * The parts of one restaurant's dashboard, in the export's order: the day's reservations first, at
 * the restaurant's own address, then the floor and the hours, the restaurant itself, and the
 * analytics last. The reservations show how many are waiting to be confirmed today.
 */
function sectionLinks(base: string, waiting: number | undefined): SideLink[] {
  return [
    {
      to: base,
      label: "Reservations",
      icon: <CalendarIcon />,
      end: true,
      count:
        waiting === undefined
          ? undefined
          : { value: waiting, label: waiting === 1 ? "1 to confirm" : `${waiting} to confirm` },
    },
    { to: `${base}/tables`, label: "Tables", icon: <TableIcon /> },
    { to: `${base}/hours`, label: "Opening hours", icon: <ClockIcon /> },
    { to: `${base}/blocks`, label: "Blocked times", icon: <BanIcon /> },
    { to: `${base}/information`, label: "Restaurant info", icon: <StoreIcon /> },
    { to: `${base}/photos`, label: "Photos", icon: <ImageIcon /> },
    { to: `${base}/analytics`, label: "Analytics", icon: <ChartIcon /> },
  ];
}

// The quiet link back to all the owner's restaurants, at the top of the menu.
const backLink =
  "inline-flex min-h-touch items-center gap-1.5 text-meta font-medium text-on-dark-secondary transition-[color] duration-button hover:text-on-dark md:min-h-0";

interface RestaurantNavProps {
  restaurant: Pick<OwnerRestaurant, "id" | "name" | "slug" | "isPublished" | "hiddenBySeghan">;
  /** Today's bookings still waiting to be confirmed, once known. */
  waiting?: number;
  /** Who's signed in, with Sign out (OfficeAccount). */
  account?: ReactNode;
  /** 1 on the page. 4 in /design's specimens, which sit under the page's own headings. */
  headingLevel?: 1 | 4;
  /** For /design: where the parts' links start, so the one at that address shows as open. */
  sectionsBase?: string;
  /** For /design: a specimen's own height, instead of the window's. */
  specimen?: boolean;
}

/**
 * One restaurant's dashboard menu, the export's dark menu down the left: the way back to all the
 * owner's restaurants, the restaurant's name, which is the page's heading, and whether guests can
 * see it, then its parts. At its foot, once guests can see it, its own page, and who's signed in.
 */
export function RestaurantNav({
  restaurant,
  waiting,
  account,
  headingLevel = 1,
  sectionsBase = `/dashboard/${restaurant.id}`,
  specimen,
}: RestaurantNavProps): ReactElement {
  const Title = headingLevel === 1 ? "h1" : "h4";
  const visible = restaurant.isPublished && !restaurant.hiddenBySeghan;
  return (
    <SideNav
      label={restaurant.name}
      links={sectionLinks(sectionsBase, waiting)}
      account={account}
      specimen={specimen}
      header={
        <>
          <Link to="/dashboard" className={backLink}>
            <ArrowLeftIcon width="14" height="14" />
            Your restaurants
          </Link>
          <Title className="mt-3 text-lead font-semibold break-words">{restaurant.name}</Title>
          <p className="text-caption text-on-dark-muted">Owner dashboard</p>
          <div className="mt-2.5">
            <PublishedBadge
              isPublished={restaurant.isPublished}
              hiddenBySeghan={restaurant.hiddenBySeghan}
            />
          </div>
        </>
      }
      footer={
        visible && (
          <Link to={`/restaurants/${restaurant.slug}`} className={sideNavFootLink}>
            See the guests’ page
            <ArrowRightIcon width="14" height="14" />
          </Link>
        )
      }
    />
  );
}
