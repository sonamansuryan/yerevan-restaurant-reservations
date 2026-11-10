import type { ReactElement } from "react";

import { LinkButton } from "@/components/Button";
import { SectionNav } from "@/components/SectionNav";
import type { SectionLink } from "@/components/SectionNav";
import { PublishedBadge } from "@/features/dashboard/components/PublishedBadge";
import type { OwnerRestaurant } from "@/types/api";

/** The parts of one restaurant's dashboard. Bookings live at the restaurant's own address. */
function sectionLinks(base: string): SectionLink[] {
  return [
    { to: base, label: "Bookings", end: true },
    { to: `${base}/information`, label: "Information" },
    { to: `${base}/hours`, label: "Opening hours" },
    { to: `${base}/photos`, label: "Photos" },
  ];
}

interface RestaurantHeaderProps {
  restaurant: Pick<OwnerRestaurant, "id" | "name" | "slug" | "isPublished">;
  /** 1 on the page. 4 in /design's specimens, which sit under the page's own headings. */
  headingLevel?: 1 | 4;
  /** For /design: where the parts' links start, so the one at that address shows as open. */
  sectionsBase?: string;
}

/**
 * The top of every part of one restaurant's dashboard: its name in serif, whether guests can see
 * it, and the row of its parts.
 */
export function RestaurantHeader({
  restaurant,
  headingLevel = 1,
  sectionsBase = `/dashboard/${restaurant.id}`,
}: RestaurantHeaderProps): ReactElement {
  const Title = headingLevel === 1 ? "h1" : "h4";
  return (
    <div>
      <LinkButton variant="link" to="/dashboard">
        Your restaurants
      </LinkButton>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <Title className="min-w-0 font-display text-section text-balance break-words">
          {restaurant.name}
        </Title>
        <PublishedBadge isPublished={restaurant.isPublished} />
      </div>
      {restaurant.isPublished && (
        <LinkButton variant="link" to={`/restaurants/${restaurant.slug}`} className="mt-1">
          See the guests’ page
        </LinkButton>
      )}
      <SectionNav label={restaurant.name} links={sectionLinks(sectionsBase)} className="mt-8" />
    </div>
  );
}
