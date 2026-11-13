import type { ReactElement, ReactNode } from "react";

import { RestaurantCard } from "@/features/restaurants/components/RestaurantCard";
import { cx } from "@/lib/cx";
import type { RestaurantSummary } from "@/types/api";

interface RestaurantGridProps {
  restaurants: RestaurantSummary[];
  /** The cards' heading level, one below the heading the grid sits under. */
  cardHeading?: "h2" | "h3" | "h4";
  /** What sits at the foot of each card: its free times on Browse, or taking it out of favorites. */
  actionFor?: (restaurant: RestaurantSummary) => ReactNode;
  /** Each card's heart on its photo (RestaurantHeart). */
  saveFor?: (restaurant: RestaurantSummary) => ReactNode;
  className?: string;
}

/**
 * Restaurant cards in rows, as the export lays them out: each at least 270px wide, as many to a row
 * as fit, four on a laptop and one on a phone.
 */
export function RestaurantGrid({
  restaurants,
  cardHeading = "h2",
  actionFor,
  saveFor,
  className,
}: RestaurantGridProps): ReactElement {
  return (
    <div
      className={cx(
        "grid grid-cols-[repeat(auto-fill,minmax(min(16.875rem,100%),1fr))] gap-6",
        className,
      )}
    >
      {restaurants.map((restaurant) => (
        <RestaurantCard
          key={restaurant.slug}
          restaurant={restaurant}
          heading={cardHeading}
          footer={actionFor?.(restaurant)}
          save={saveFor?.(restaurant)}
        />
      ))}
    </div>
  );
}
