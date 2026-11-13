import { Fragment } from "react";
import type { ReactElement } from "react";

import { weekRows } from "@/features/restaurants/openingHours";
import { cx } from "@/lib/cx";
import type { OpeningHours } from "@/types/api";

interface OpeningHoursListProps {
  hours: OpeningHours[];
  /** Today's weekday in Yerevan, 0 = Sunday, so its line can be marked. */
  today?: number;
}

/**
 * The week, Monday first, as the export lists it: the days in a quiet column, their hours beside
 * them, and today's line in bold, marked "(today)". A closed day says so, and a split shift shows
 * both times, one under the other. Screen readers hear "18:00 to 02:00" instead of a dash.
 */
export function OpeningHoursList({ hours, today }: OpeningHoursListProps): ReactElement {
  if (hours.length === 0) {
    return <p className="text-ui text-ink-muted">Opening hours aren’t listed yet.</p>;
  }

  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 text-input">
      {weekRows(hours).map(({ dayOfWeek, day, shifts }) => {
        const isToday = dayOfWeek === today;
        return (
          <Fragment key={dayOfWeek}>
            <dt className={isToday ? "font-semibold text-ink" : "text-ink-secondary"}>
              {day}
              {isToday && " (today)"}
            </dt>
            <dd className={cx("tabular-nums", isToday && "font-semibold")}>
              {shifts.length === 0
                ? "Closed"
                : shifts.map(({ opens, closes }) =>
                    // From midnight to midnight would read "00:00 – 00:00", which says nothing.
                    opens === "00:00" && closes === "00:00" ? (
                      <span key={opens} className="block">
                        Open all day
                      </span>
                    ) : (
                      <span key={opens} className="block">
                        <span aria-hidden="true">
                          {opens} – {closes}
                        </span>
                        <span className="sr-only">
                          {opens} to {closes}
                        </span>
                      </span>
                    ),
                  )}
            </dd>
          </Fragment>
        );
      })}
    </dl>
  );
}
