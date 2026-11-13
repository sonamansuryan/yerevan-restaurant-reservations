import type { ReactElement } from "react";

import { PartHeader } from "@/components/PartHeader";
import { AnalyticsReport } from "@/features/analytics/components/AnalyticsReport";
import { MostBooked } from "@/features/analytics/components/MostBooked";
import { useSeghanAnalytics } from "@/features/analytics/hooks/useSeghanAnalytics";

/** /admin/analytics: how all of Seghan did, with the most booked restaurants. */
export function AdminAnalyticsPage(): ReactElement {
  const analytics = useSeghanAnalytics();
  return (
    <>
      <title>Analytics · Admin · Seghan</title>
      <PartHeader
        title="Analytics"
        description="How all of Seghan did, over the days you choose."
        className="mb-6"
      />
      <AnalyticsReport
        {...analytics}
        more={(numbers) => <MostBooked restaurants={numbers.restaurants} />}
      />
    </>
  );
}
