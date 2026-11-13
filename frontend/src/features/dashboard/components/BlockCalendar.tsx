import { useState } from "react";
import type { ReactElement } from "react";

import { ArrowLeftIcon, ArrowRightIcon } from "@/components/icons";
import { blockedDays } from "@/features/dashboard/blocks";
import { cx } from "@/lib/cx";
import { daysFrom, formatMonth, shiftDate, weekdayOf } from "@/lib/time";
import type { OwnerBlock } from "@/types/api";

interface BlockCalendarProps {
  blocks: OwnerBlock[];
  /** Today in Yerevan: the month shown first, and the day ringed. */
  today: string;
  /** 3 on the page, under the part's heading. 4 in /design's specimens. */
  headingLevel?: 3 | 4;
  className?: string;
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

// Earlier and later months: small square buttons, 44px wherever there's a touch screen.
const turn =
  "grid size-9 place-items-center rounded-chip border border-line bg-surface-raised text-ink transition-[border-color] duration-button hover:border-ink any-pointer-coarse:size-11";

/** The first day of the month after a YYYY-MM-01 date. */
function nextMonth(first: string): string {
  const [year, month] = [Number(first.slice(0, 4)), Number(first.slice(5, 7))];
  return month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

/** The first day of the month before a YYYY-MM-01 date. */
function previousMonth(first: string): string {
  return `${shiftDate(first, -1).slice(0, 7)}-01`;
}

/**
 * The blocks on a month's calendar, as the export has it: the days blocked for the whole restaurant
 * in wine, the days only partly blocked in pink, and today ringed. Earlier and later move a month at
 * a time. The list beside it says the same in words, so screen readers hear the month's count
 * instead of every day.
 */
export function BlockCalendar({
  blocks,
  today,
  headingLevel = 3,
  className,
}: BlockCalendarProps): ReactElement {
  const Heading = headingLevel === 3 ? "h3" : "h4";
  const [first, setFirst] = useState(() => `${today.slice(0, 7)}-01`);
  const days = blockedDays(blocks);
  const length = daysFrom(first, nextMonth(first));
  // Monday first, as calendars in Armenia start the week.
  const leading = (weekdayOf(first) + 6) % 7;
  const dates = Array.from({ length }, (_, index) => shiftDate(first, index));
  const whole = dates.filter((date) => days.get(date) === "whole").length;
  const partial = dates.filter((date) => days.get(date) === "partial").length;

  return (
    <section
      className={cx(
        "flex min-w-0 flex-col gap-3.5 rounded-band border border-line bg-surface-raised p-5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <Heading className="text-body font-semibold">{formatMonth(first)}</Heading>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setFirst(previousMonth(first))}
            className={turn}
          >
            <ArrowLeftIcon />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setFirst(nextMonth(first))}
            className={turn}
          >
            <ArrowRightIcon />
          </button>
        </div>
      </div>
      <p className="sr-only">
        {whole === 0 && partial === 0
          ? "Nothing blocked this month."
          : `This month: ${whole === 1 ? "1 day" : `${whole} days`} blocked for the whole restaurant, ${partial === 1 ? "1 day" : `${partial} days`} partly blocked.`}
      </p>
      <div aria-hidden="true" className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((day) => (
          <span key={day} className="py-1 text-caption font-semibold text-ink-secondary">
            {day}
          </span>
        ))}
        {Array.from({ length: leading }, (_, index) => (
          <span key={`blank-${index}`} />
        ))}
        {dates.map((date) => {
          const kind = days.get(date);
          return (
            <span
              key={date}
              className={cx(
                "rounded-chip py-2 text-meta tabular-nums",
                kind === "whole" && "bg-accent font-semibold text-on-accent",
                kind === "partial" && "border border-accent bg-error-soft font-semibold text-error",
                !kind && (date < today ? "text-ink-muted" : "text-ink"),
                date === today && !kind && "font-bold ring-2 ring-ink ring-inset",
              )}
            >
              {Number(date.slice(8))}
            </span>
          );
        })}
      </div>
      <ul
        aria-hidden="true"
        className="flex flex-wrap gap-x-3.5 gap-y-1 text-caption text-ink-secondary"
      >
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-check bg-accent" />
          Whole restaurant blocked
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-check border border-accent bg-error-soft" />
          Partly blocked
        </li>
      </ul>
    </section>
  );
}
