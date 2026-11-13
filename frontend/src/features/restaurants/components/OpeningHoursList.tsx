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
 * The week as lines on a menu, Monday first: `Friday ····· 18:00–02:00`. A closed day says so, and
 * a split shift shows both times. Screen readers hear "18:00 to 02:00" instead of a dash.
 */
export function OpeningHoursList({ hours, today }: OpeningHoursListProps): ReactElement {
  if (hours.length === 0) {
    return <p className="text-ui text-ink-muted">Opening hours aren’t listed yet.</p>;
  }

  return (
    <dl className="text-ui">
      {weekRows(hours).map(({ dayOfWeek, day, shifts }) => {
        const isToday = dayOfWeek === today;
        return (
          <div
            key={dayOfWeek}
            className={cx(
              "flex items-baseline gap-2 border-b border-line py-3",
              isToday ? "font-medium text-ink" : "text-ink-secondary",
            )}
          >
            <dt className="flex flex-1 items-baseline gap-2">
              <span>{day}</span>
              {isToday && <span className="text-eyebrow text-accent uppercase">Today</span>}
              <span aria-hidden="true" className="menu-leader" />
            </dt>
            <dd className="text-right tabular-nums">
              {shifts.length === 0
                ? "Closed"
                : shifts.map(({ opens, closes }) =>
                    // From midnight to midnight would read "00:00–00:00", which says nothing.
                    opens === "00:00" && closes === "00:00" ? (
                      <span key={opens} className="block">
                        Open all day
                      </span>
                    ) : (
                      <span key={opens} className="block">
                        <span aria-hidden="true">
                          {opens}–{closes}
                        </span>
                        <span className="sr-only">
                          {opens} to {closes}
                        </span>
                      </span>
                    ),
                  )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
