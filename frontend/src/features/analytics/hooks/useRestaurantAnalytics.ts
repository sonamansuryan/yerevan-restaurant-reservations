import type { AnalyticsPart } from "@/features/analytics/components/AnalyticsReport";
import { useAnalytics } from "@/features/analytics/hooks/useAnalytics";
import { ownerKeys, ownerRestaurantPath } from "@/features/dashboard/queryKeys";
import type { Analytics } from "@/types/api";

/** One of the owner's restaurants: its numbers for the period in the address. */
export function useRestaurantAnalytics(restaurantId: string): AnalyticsPart<Analytics> {
  return useAnalytics<Analytics>({
    key: (days) => ownerKeys.analytics(restaurantId, days),
    path: (days) => `${ownerRestaurantPath(restaurantId)}/analytics?days=${days}`,
    // Another restaurant's numbers never stand in for this one's: the id is the key's third part.
    sameAs: (key, earlier) => key[2] === earlier[2],
  });
}
