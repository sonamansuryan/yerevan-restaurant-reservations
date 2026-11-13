import type { ReactElement, ReactNode } from "react";

import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Spinner } from "@/components/Spinner";
import { RestaurantCard } from "@/features/restaurants/components/RestaurantCard";
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
  /** Each card's times for tonight. The page wires them: TonightTimes. */
  timesFor?: (restaurant: RestaurantSummary) => ReactNode;
  /** Each card's heart. The page wires them: RestaurantHeart. */
  saveFor?: (restaurant: RestaurantSummary) => ReactNode;
  className?: string;
}

/**
 * The home page's restaurants in every state: loading, failed, none yet, and the cards, each with
 * tonight's times. As in the export, the cards are at least 270px wide, as many to a row as fit:
 * four on a laptop, one on a phone.
 */
export function FeaturedRestaurants({
  results,
  failed = false,
  retrying = false,
  onRetry,
  cardHeading = "h3",
  timesFor,
  saveFor,
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
    <div
      className={cx(
        "grid grid-cols-[repeat(auto-fill,minmax(min(16.875rem,100%),1fr))] gap-6",
        className,
      )}
    >
      {/* Browse's card, without its description, so tonight's times sit close to the name. */}
      {results.data.map((restaurant) => (
        <RestaurantCard
          key={restaurant.slug}
          restaurant={restaurant}
          heading={cardHeading}
          description={false}
          footer={timesFor?.(restaurant)}
          save={saveFor?.(restaurant)}
        />
      ))}
    </div>
  );
}
