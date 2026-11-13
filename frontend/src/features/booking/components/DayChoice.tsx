import { useId, useState } from "react";
import type { ReactElement } from "react";

import { ArrowLeftIcon, ArrowRightIcon } from "@/components/icons";
import { DAYS_SHOWN, rowStartFor } from "@/features/booking/booking";
import { cx } from "@/lib/cx";
import { dayParts, formatDayHeading, formatMonthSpan, shiftDate } from "@/lib/time";

interface DayChoiceProps {
  /** The day chosen, as YYYY-MM-DD. */
  date: string;
  /** Today in Yerevan, the first day to choose. */
  today: string;
  /** The last day guests can book, from the availability. Until it's known, 60 days ahead. */
  last?: string;
  onChoose: (date: string) => void;
}

// Earlier and later: small square buttons beside the month, 44px wherever there's a touch screen.
const turn =
  "grid size-9 place-items-center rounded-card border border-line bg-surface-raised text-ink transition-[border-color] duration-button hover:border-ink disabled:cursor-not-allowed disabled:border-line-soft disabled:text-ink-muted/60 any-pointer-coarse:size-11";

/**
 * The day, as the export's booking panel picks it: five days in a row, each its weekday over its
 * date, the chosen one filled in ink. Earlier and later move the row by five days, from today to the
 * last day guests can book, and the month above says which month the row is in. Each day is a
 * button, read out with its whole date and whether it's the one chosen.
 */
export function DayChoice({ date, today, last, onChoose }: DayChoiceProps): ReactElement {
  const labelId = useId();
  const lastDay = last ?? shiftDate(today, 60);
  const [rowStart, setRowStart] = useState(() => rowStartFor(date, today));
  // A day chosen elsewhere, such as from a link, outside the row shown: the row moves to it.
  const [shownFor, setShownFor] = useState(date);
  if (shownFor !== date) {
    setShownFor(date);
    const inRow = date >= rowStart && date <= shiftDate(rowStart, DAYS_SHOWN - 1);
    if (!inRow) setRowStart(rowStartFor(date, today));
  }

  const days = Array.from({ length: DAYS_SHOWN }, (_, index) => shiftDate(rowStart, index)).filter(
    (day) => day <= lastDay,
  );
  const rowEnd = days.at(-1) ?? rowStart;

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-ui">
          <span id={labelId} className="font-semibold text-ink">
            Date
          </span>
          <span className="ml-2 text-ink-secondary">{formatMonthSpan(rowStart, rowEnd)}</span>
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Earlier days"
            disabled={rowStart <= today}
            onClick={() => setRowStart(shiftDate(rowStart, -DAYS_SHOWN))}
            className={turn}
          >
            <ArrowLeftIcon />
          </button>
          <button
            type="button"
            aria-label="Later days"
            disabled={shiftDate(rowStart, DAYS_SHOWN) > lastDay}
            onClick={() => setRowStart(shiftDate(rowStart, DAYS_SHOWN))}
            className={turn}
          >
            <ArrowRightIcon />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {days.map((day) => {
          const { weekday, day: dayOfMonth } = dayParts(day);
          const chosen = day === date;
          return (
            <button
              key={day}
              type="button"
              aria-pressed={chosen}
              aria-label={formatDayHeading(day, today)}
              onClick={() => onChoose(day)}
              className={cx(
                "flex flex-col items-center rounded-hero border py-2 transition-[border-color,background-color,color] duration-150",
                chosen
                  ? "border-ink bg-ink text-on-dark ring-1 ring-ink"
                  : "border-line bg-surface-raised text-ink hover:border-ink",
              )}
            >
              <span className="text-label font-semibold uppercase">{weekday}</span>
              <span className="text-lead font-bold tabular-nums">{dayOfMonth}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
