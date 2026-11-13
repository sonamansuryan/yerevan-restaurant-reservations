import { useState } from "react";
import type { ReactElement } from "react";

import { AnalyticsReport } from "@/features/analytics/components/AnalyticsReport";
import type { AnalyticsReportState } from "@/features/analytics/components/AnalyticsReport";
import { MostBooked } from "@/features/analytics/components/MostBooked";
import { Group, Specimens } from "@/features/design/components/parts";
import {
  firstWeekAnalytics,
  loriAnalytics,
  quietAnalytics,
  seghanAnalytics,
  seghanWithLongName,
} from "@/features/design/samples";
import type { screenStates } from "@/features/design/tokens";
import type { Analytics, AnalyticsDays, SeghanAnalytics } from "@/types/api";

type StateOf<K extends keyof typeof screenStates> = (typeof screenStates)[K][number];

const ignore = (): void => {};

function shown<T extends Analytics>(
  data: T | undefined,
  change: Partial<AnalyticsReportState<T>> = {},
): AnalyticsReportState<T> {
  return { data, failed: false, retrying: false, onRetry: ignore, updating: false, ...change };
}

/** The period choice works here: it swaps Lori's samples, and sends nothing. */
function LiveAnalytics(): ReactElement {
  const [days, setDays] = useState<AnalyticsDays>(30);
  return (
    <AnalyticsReport
      days={days}
      onDaysChange={setDays}
      report={shown(loriAnalytics[days])}
      headingLevel={4}
    />
  );
}

const owner = (days: AnalyticsDays, report: AnalyticsReportState<Analytics>): ReactElement => (
  <AnalyticsReport days={days} onDaysChange={ignore} report={report} headingLevel={4} />
);

const ownerStates: Record<StateOf<"analytics">, ReactElement> = {
  "The last 30 days (live)": <LiveAnalytics />,
  // The 7 days are chosen, and the 30 stay on screen, faded, until the 7 come.
  "The next period loading": owner(7, shown(loriAnalytics[30], { updating: true })),
  "No reviews yet": owner(7, shown(firstWeekAnalytics)),
  "No bookings in these days": owner(30, shown(quietAnalytics())),
  "No bookings, even in 90 days": owner(
    90,
    shown(quietAnalytics({ days: 90, from: "2026-08-14", to: "2026-11-11" })),
  ),
  Loading: owner(30, shown(undefined)),
  "Couldn’t load": owner(30, shown(undefined, { failed: true })),
};

const admin = (report: AnalyticsReportState<SeghanAnalytics>): ReactElement => (
  <AnalyticsReport
    days={30}
    onDaysChange={ignore}
    report={report}
    headingLevel={4}
    more={(numbers) => <MostBooked restaurants={numbers.restaurants} headingLevel={4} />}
  />
);

const adminStates: Record<StateOf<"adminAnalytics">, ReactElement> = {
  "All of Seghan, the last 30 days": admin(shown(seghanAnalytics)),
  "A long Armenian name": admin(shown(seghanWithLongName)),
  "No bookings in these days": admin(shown({ ...quietAnalytics(), restaurants: [] })),
  Loading: admin(shown<SeghanAnalytics>(undefined)),
  "Couldn’t load": admin(shown<SeghanAnalytics>(undefined, { failed: true })),
};

/** How a restaurant did, on its dashboard, and how all of Seghan did, in the admin area (9.6). */
export function AnalyticsScreens(): ReactElement {
  return (
    <>
      <Group
        title="Analytics, on the dashboard"
        note="/dashboard/:restaurantId/analytics, after Bookings: how the restaurant did over the last 7, 30 or 90 days, today included, by the day each booking is for. Guests are the people in bookings marked arrived, and the ratings are those bookings' reviews. The period applies at once and lives in the address, and while the next one loads, the last stays on screen, faded. In the live one, the period swaps the samples, and nothing is sent."
      >
        <Specimens wide specimens={ownerStates} />
      </Group>
      <Group
        title="Analytics, in the admin area"
        note="/admin/analytics, after Reservations: the same numbers for every restaurant on Seghan, drafts and hidden ones included, on Yerevan's calendar. Then the ten with the most bookings, each bar against the busiest."
      >
        <Specimens wide specimens={adminStates} />
      </Group>
    </>
  );
}
