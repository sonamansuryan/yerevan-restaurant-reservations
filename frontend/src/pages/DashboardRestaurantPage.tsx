import { useState } from "react";
import type { ReactElement } from "react";
import { Outlet, useParams } from "react-router";

import { OfficeAccount } from "@/components/OfficeAccount";
import { OfficeLayout } from "@/components/OfficeLayout";
import { useAccount } from "@/features/auth/hooks/useAccount";
import {
  DashboardLoadFailed,
  DashboardLoading,
} from "@/features/dashboard/components/DashboardStates";
import { OwnerNav } from "@/features/dashboard/components/OwnerNav";
import { RestaurantNav } from "@/features/dashboard/components/RestaurantNav";
import type { DashboardRestaurantContext } from "@/features/dashboard/hooks/useDashboardRestaurant";
import { useDayReservations } from "@/features/dashboard/hooks/useDayReservations";
import { useOwnerRestaurant } from "@/features/dashboard/hooks/useOwnerRestaurant";
import { yerevanToday } from "@/lib/time";
import { NotFoundPage } from "@/pages/NotFoundPage";

/**
 * One restaurant's dashboard: its dark menu down the left, the window's full height, beside the
 * part that's open, or above it on a phone. The restaurant is loaded once here and handed to each
 * part. Today's bookings are asked for here too, for the menu's count of those to confirm: the
 * same request the Reservations part makes for today, so the two always agree.
 */
export function DashboardRestaurantPage(): ReactElement {
  const { restaurantId = "" } = useParams();
  const restaurant = useOwnerRestaurant(restaurantId);
  const account = <OfficeAccount account={useAccount()} />;
  // Read once, when the page opens: a page has to render the same way each time.
  const [today] = useState(() => yerevanToday());
  const day = useDayReservations(restaurantId, today, 1, restaurant.data !== undefined);
  const waiting = day.data?.data.filter(({ status }) => status === "PENDING").length;

  if (restaurant.data) {
    const context: DashboardRestaurantContext = { restaurant: restaurant.data };
    return (
      <OfficeLayout
        nav={<RestaurantNav restaurant={restaurant.data} waiting={waiting} account={account} />}
      >
        <Outlet context={context} />
      </OfficeLayout>
    );
  }

  // The API answers alike for a restaurant that doesn't exist and someone else's. An address
  // that isn't a restaurant's id at all is refused before that (400).
  if (restaurant.error?.status === 404 || restaurant.error?.status === 400) {
    return (
      <OfficeLayout nav={<OwnerNav account={account} />}>
        <NotFoundPage
          title="Restaurant not found"
          description="The link may be out of date, or the restaurant may be on another account."
          action={{ to: "/dashboard", label: "Your restaurants" }}
        />
      </OfficeLayout>
    );
  }

  // A retry clears the error while it runs. Staying on the error keeps Try again on the page.
  const retrying = restaurant.isFetching && restaurant.errorUpdateCount > 0;
  if (restaurant.isError || retrying) {
    return (
      <OfficeLayout nav={<OwnerNav account={account} />}>
        <title>Something went wrong · Seghan</title>
        <h1 className="sr-only">Something went wrong</h1>
        <div className="flex flex-col items-center py-section-sm">
          <DashboardLoadFailed
            what="this restaurant"
            onRetry={() => void restaurant.refetch()}
            retrying={retrying}
          />
        </div>
      </OfficeLayout>
    );
  }

  return (
    <OfficeLayout nav={<OwnerNav account={account} />}>
      <div className="flex justify-center py-section-sm">
        <DashboardLoading label="Loading the restaurant" />
      </div>
    </OfficeLayout>
  );
}
