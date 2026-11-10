import { useState } from "react";
import type { ReactElement } from "react";
import { useParams } from "react-router";

import { LinkButton } from "@/components/Button";
import { PageContainer } from "@/components/PageContainer";
import { RestaurantDetails } from "@/features/restaurants/components/RestaurantDetails";
import {
  RestaurantLoadFailed,
  RestaurantLoading,
} from "@/features/restaurants/components/RestaurantStates";
import { useRestaurant } from "@/features/restaurants/hooks/useRestaurant";
import { yerevanWeekday } from "@/lib/time";
import { NotFoundPage } from "@/pages/NotFoundPage";
import type { RestaurantDetail } from "@/types/api";

export function RestaurantPage(): ReactElement {
  const { slug = "" } = useParams();
  const restaurant = useRestaurant(slug);

  if (restaurant.data) return <LoadedRestaurant restaurant={restaurant.data} />;

  // The API answers alike for a restaurant that doesn't exist and one that isn't published.
  if (restaurant.error?.status === 404) {
    return (
      <NotFoundPage
        title="Restaurant not found"
        description="The link may be out of date, or the restaurant may not be on Seghan yet."
        action={{ to: "/restaurants", label: "See all restaurants" }}
      />
    );
  }

  // A retry clears the error while it runs. Staying on the error keeps Try again on the page.
  const retrying = restaurant.isFetching && restaurant.errorUpdateCount > 0;
  if (restaurant.isError || retrying) {
    return (
      <PageContainer className="flex flex-col items-center py-section-sm md:py-section-lg">
        <title>Something went wrong · Seghan</title>
        <h1 className="sr-only">Something went wrong</h1>
        <RestaurantLoadFailed onRetry={() => void restaurant.refetch()} retrying={retrying} />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="page-fill flex items-center justify-center py-section-sm">
      <RestaurantLoading />
    </PageContainer>
  );
}

function LoadedRestaurant({ restaurant }: { restaurant: RestaurantDetail }): ReactElement {
  // Read once, when the page opens: a page has to render the same way each time.
  const [today] = useState(() => yerevanWeekday(new Date()));

  return (
    <PageContainer className="py-section-sm">
      <title>{`${restaurant.name} · Seghan`}</title>
      <LinkButton variant="link" to="/restaurants">
        All restaurants
      </LinkButton>
      <RestaurantDetails restaurant={restaurant} today={today} className="mt-4" />
    </PageContainer>
  );
}
