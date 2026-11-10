import type { ReactElement } from "react";

import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Spinner } from "@/components/Spinner";
import { RestaurantGrid } from "@/features/restaurants/components/RestaurantGrid";
import { cx } from "@/lib/cx";
import type { ListResponse, RestaurantSummary } from "@/types/api";

interface FeaturedRestaurantsProps {
  /** The few restaurants, or undefined before the first answer. */
  results?: ListResponse<RestaurantSummary>;
  /** The first answer didn't come. */
  failed?: boolean;
  /** True while Try again runs. */
  retrying?: boolean;
  onRetry: () => void;
  /** h3 under the home page's section heading. */
  cardHeading?: "h2" | "h3" | "h4";
  className?: string;
}

/** The home page's few restaurants in every state: loading, failed, none yet, and the cards. */
export function FeaturedRestaurants({
  results,
  failed = false,
  retrying = false,
  onRetry,
  cardHeading = "h3",
  className,
}: FeaturedRestaurantsProps): ReactElement {
  if (!results) {
    // A retry clears the error while it runs. Staying on the error keeps Try again on the page.
    if (failed || retrying) {
      return (
        <ErrorState
          title="Our apologies"
          description="We couldn’t load the restaurants."
          onRetry={onRetry}
          retrying={retrying}
          className={className}
        />
      );
    }
    return (
      <div className={cx("flex min-h-60 items-center justify-center", className)}>
        <Spinner label="Loading restaurants" />
      </div>
    );
  }

  if (results.data.length === 0) {
    return (
      <EmptyState
        title="No restaurants yet"
        description="Restaurants appear here once they’re published."
        className={className}
      />
    );
  }

  return (
    <RestaurantGrid restaurants={results.data} cardHeading={cardHeading} className={className} />
  );
}
