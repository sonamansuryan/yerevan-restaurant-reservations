import type { ReactElement } from "react";

import { RestaurantCard } from "@/features/restaurants/components/RestaurantCard";
import { cx } from "@/lib/cx";
import type { RestaurantSummary } from "@/types/api";

interface RestaurantGridProps {
  restaurants: RestaurantSummary[];
  /** The cards' heading level, one below the heading the grid sits under. */
  cardHeading?: "h2" | "h3" | "h4";
  className?: string;
}

/** Restaurant cards in rows: one on a phone, two from 640px, three from 1024px. */
export function RestaurantGrid({
  restaurants,
  cardHeading = "h2",
  className,
}: RestaurantGridProps): ReactElement {
  return (
    <div className={cx("grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {restaurants.map((restaurant) => (
        <RestaurantCard key={restaurant.slug} restaurant={restaurant} heading={cardHeading} />
      ))}
    </div>
  );
}
