import { adminKeys } from "@/features/admin/admin";
import type { AnalyticsPart } from "@/features/analytics/components/AnalyticsReport";
import { useAnalytics } from "@/features/analytics/hooks/useAnalytics";
import type { SeghanAnalytics } from "@/types/api";

/** All of Seghan's numbers, for the admin, for the period in the address. */
export function useSeghanAnalytics(): AnalyticsPart<SeghanAnalytics> {
  return useAnalytics<SeghanAnalytics>({
    key: (days) => adminKeys.analytics(days),
    path: (days) => `/api/admin/analytics?days=${days}`,
    // Every period is Seghan's, so the last one can always stay on screen while the next loads.
    sameAs: () => true,
  });
}
