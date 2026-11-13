import type { ReactElement, ReactNode } from "react";

import { BarList } from "@/components/BarList";
import { EmptyState } from "@/components/EmptyState";
import { Figures } from "@/components/Figures";
import { Select } from "@/components/Select";
import {
  ANALYTICS_DAYS,
  PERIOD_CHOICES,
  analyticsFigures,
  ratingBars,
  statusBars,
} from "@/features/analytics/analytics";
import {
  DashboardLoadFailed,
  DashboardLoading,
} from "@/features/dashboard/components/DashboardStates";
import { cx } from "@/lib/cx";
import { formatDayRange } from "@/lib/time";
import type { Analytics, AnalyticsDays } from "@/types/api";

/** The numbers for one period, as a page has them. */
export interface AnalyticsReportState<T extends Analytics> {
  /** The numbers, once they've come. */
  data: T | undefined;
  /** The first answer didn't come. */
  failed: boolean;
  /** True while Try again runs. */
  retrying: boolean;
  onRetry: () => void;
  /** Another period's numbers are on their way. The last ones stay on screen meanwhile. */
  updating: boolean;
}

export interface AnalyticsReportProps<T extends Analytics> {
  /** The period chosen, which the numbers on screen may not be yet while they load. */
  days: AnalyticsDays;
  onDaysChange: (days: AnalyticsDays) => void;
  report: AnalyticsReportState<T>;
  /** Anything only these numbers have, after the rest, such as the admin's most booked. */
  more?: (analytics: T) => ReactNode;
  /** 3 on the page, under its own heading. 4 in /design's specimens. */
  headingLevel?: 3 | 4;
  className?: string;
}

/** What a page hands the report: the period and its numbers. */
export type AnalyticsPart<T extends Analytics> = Pick<
  AnalyticsReportProps<T>,
  "days" | "onDaysChange" | "report"
>;

interface PartProps {
  title: string;
  headingLevel: 3 | 4;
  children: ReactNode;
}

/** One part of the report: a functional heading in serif, and its lines. */
export function ReportPart({ title, headingLevel, children }: PartProps): ReactElement {
  const Heading = headingLevel === 3 ? "h3" : "h4";
  return (
    <section className="min-w-0">
      <Heading className="font-display text-title">{title}</Heading>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Report<T extends Analytics>({
  analytics,
  more,
  headingLevel,
}: {
  analytics: T;
  more: AnalyticsReportProps<T>["more"];
  headingLevel: 3 | 4;
}): ReactElement {
  return (
    <div className="flex flex-col gap-12">
      <Figures figures={analyticsFigures(analytics)} />
      {/* Two parts to a row on a wide screen, anything more included, so every bar has the
          same room to grow. */}
      <div className="grid gap-x-16 gap-y-12 lg:grid-cols-2">
        <ReportPart title="Bookings by status" headingLevel={headingLevel}>
          <BarList bars={statusBars(analytics)} max={analytics.bookings} />
        </ReportPart>
        <ReportPart title="Ratings" headingLevel={headingLevel}>
          {analytics.ratings.count > 0 ? (
            <BarList bars={ratingBars(analytics)} max={analytics.ratings.count} />
          ) : (
            <p className="border-t border-line pt-3 text-ui text-ink-secondary">
              No reviews of these bookings yet. Guests can leave one after a visit marked arrived.
            </p>
          )}
        </ReportPart>
        {more?.(analytics)}
      </div>
    </div>
  );
}

/**
 * How a restaurant, or all of Seghan, did over the last 7, 30 or 90 days: the bookings, the guests
 * who came, cancellations, no-shows and the rating as numbers, then each status and each rating
 * as simple bars. Everything counts the bookings for those days, by the day each is for, and the
 * ratings are those bookings' reviews. The period applies at once, and lives in the address.
 */
export function AnalyticsReport<T extends Analytics>({
  days,
  onDaysChange,
  report,
  more,
  headingLevel = 3,
  className,
}: AnalyticsReportProps<T>): ReactElement {
  const { data } = report;

  let body: ReactElement;
  if (!data) {
    // A retry clears the error while it runs. Staying on the error keeps Try again on the page.
    body =
      report.failed || report.retrying ? (
        <DashboardLoadFailed
          what="the numbers"
          onRetry={report.onRetry}
          retrying={report.retrying}
        />
      ) : (
        <DashboardLoading label="Loading the numbers" />
      );
  } else if (data.bookings === 0) {
    const longest = ANALYTICS_DAYS[ANALYTICS_DAYS.length - 1] ?? days;
    body = (
      <EmptyState
        title="No bookings in these days"
        description="The numbers appear here once guests book a table for one of them."
        // A longer look back is the one next step, unless that's already the period chosen.
        action={
          days < longest
            ? {
                label: `Show ${PERIOD_CHOICES[longest].toLowerCase()}`,
                onClick: () => onDaysChange(longest),
              }
            : undefined
        }
      />
    );
  } else {
    body = <Report analytics={data} more={more} headingLevel={headingLevel} />;
  }

  return (
    <div className={cx("flex flex-col gap-10", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
        <Select
          label="Period"
          value={String(days)}
          onChange={(event) =>
            onDaysChange(
              ANALYTICS_DAYS.find((choice) => String(choice) === event.target.value) ?? days,
            )
          }
          className="sm:w-60"
        >
          {ANALYTICS_DAYS.map((choice) => (
            <option key={choice} value={choice}>
              {PERIOD_CHOICES[choice]}
            </option>
          ))}
        </Select>
        {data && (
          // The days of the numbers on screen, which may still be the last period's while the
          // next loads. Read out when they change, so screen reader users hear the new period.
          <p role="status" className="text-ui text-ink-secondary sm:pb-3 sm:text-right">
            {formatDayRange(data.period.from, data.period.to)}, by the day each booking is for
          </p>
        )}
      </div>
      <div
        aria-busy={report.updating || undefined}
        className={cx("transition-opacity duration-button", report.updating && "opacity-60")}
      >
        {body}
      </div>
    </div>
  );
}
