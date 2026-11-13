import type { ReactElement } from "react";

import { AnalyticsReport } from "@/features/analytics/components/AnalyticsReport";
import { MostBooked } from "@/features/analytics/components/MostBooked";
import { useSeghanAnalytics } from "@/features/analytics/hooks/useSeghanAnalytics";

/** /admin/analytics: how all of Seghan did, with the most booked restaurants. */
export function AdminAnalyticsPage(): ReactElement {
  const analytics = useSeghanAnalytics();
  return (
    <>
      <title>Analytics · Admin · Seghan</title>
      <h2 className="sr-only">Analytics</h2>
      <AnalyticsReport
        {...analytics}
        more={(numbers) => <MostBooked restaurants={numbers.restaurants} />}
      />
    </>
  );
}
