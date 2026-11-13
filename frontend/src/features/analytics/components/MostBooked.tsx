import type { ReactElement } from "react";

import { BarList } from "@/components/BarList";
import { ReportPart } from "@/features/analytics/components/AnalyticsReport";
import type { MostBookedRestaurant } from "@/types/api";

interface MostBookedProps {
  restaurants: MostBookedRestaurant[];
  /** 3 on the page. 4 in /design's specimens. */
  headingLevel?: 3 | 4;
}

/**
 * The admin's restaurants with the most bookings for the period, the most first, each bar against
 * the busiest. A long name wraps above its bar on a phone.
 */
export function MostBooked({ restaurants, headingLevel = 3 }: MostBookedProps): ReactElement {
  return (
    <ReportPart title="Most booked" headingLevel={headingLevel}>
      <BarList
        bars={restaurants.map(({ id, name, bookings }) => ({
          key: id,
          label: <span className="font-semibold">{name}</span>,
          value: bookings,
        }))}
      />
    </ReportPart>
  );
}
