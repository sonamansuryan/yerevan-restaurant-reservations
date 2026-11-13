import type { ReactElement } from "react";

import { PartHeader } from "@/components/PartHeader";
import { AnalyticsReport } from "@/features/analytics/components/AnalyticsReport";
import { useRestaurantAnalytics } from "@/features/analytics/hooks/useRestaurantAnalytics";
import { useDashboardRestaurant } from "@/features/dashboard/hooks/useDashboardRestaurant";

/** /dashboard/:restaurantId/analytics: how the restaurant did, for the period in the address. */
export function DashboardAnalyticsPage(): ReactElement {
  const restaurant = useDashboardRestaurant();
  const analytics = useRestaurantAnalytics(restaurant.id);
  return (
    <>
      <title>{`Analytics · ${restaurant.name} · Seghan`}</title>
      <PartHeader
        title="Analytics"
        description="Your bookings and ratings, over the days you choose."
        className="mb-6"
      />
      <AnalyticsReport {...analytics} />
    </>
  );
}
