import type { ReactElement } from "react";
import { Outlet, useParams } from "react-router";

import { PageContainer } from "@/components/PageContainer";
import {
  DashboardLoadFailed,
  DashboardLoading,
} from "@/features/dashboard/components/DashboardStates";
import { RestaurantHeader } from "@/features/dashboard/components/RestaurantHeader";
import type { DashboardRestaurantContext } from "@/features/dashboard/hooks/useDashboardRestaurant";
import { useOwnerRestaurant } from "@/features/dashboard/hooks/useOwnerRestaurant";
import { NotFoundPage } from "@/pages/NotFoundPage";

/**
 * One restaurant's dashboard: its header and the row of its parts, with the part that's open below.
 * The restaurant is loaded once here and handed to each part.
 */
export function DashboardRestaurantPage(): ReactElement {
  const { restaurantId = "" } = useParams();
  const restaurant = useOwnerRestaurant(restaurantId);

  if (restaurant.data) {
    const context: DashboardRestaurantContext = { restaurant: restaurant.data };
    return (
      <PageContainer className="py-section-sm">
        <RestaurantHeader restaurant={restaurant.data} />
        <div className="mt-10">
          <Outlet context={context} />
        </div>
      </PageContainer>
    );
  }

  // The API answers alike for a restaurant that doesn't exist and someone else's. An address
  // that isn't a restaurant's id at all is refused before that (400).
  if (restaurant.error?.status === 404 || restaurant.error?.status === 400) {
    return (
      <NotFoundPage
        title="Restaurant not found"
        description="The link may be out of date, or the restaurant may be on another account."
        action={{ to: "/dashboard", label: "Your restaurants" }}
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
        <DashboardLoadFailed
          what="this restaurant"
          onRetry={() => void restaurant.refetch()}
          retrying={retrying}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="page-fill flex items-center justify-center py-section-sm">
      <DashboardLoading label="Loading the restaurant" />
    </PageContainer>
  );
}
