import { zodResolver } from "@hookform/resolvers/zod";
import type { ReactElement } from "react";
import { useForm } from "react-hook-form";
import type { To } from "react-router";
import { z } from "zod";

import { Button, LinkButton } from "@/components/Button";
import { Input } from "@/components/Input";
import { formatDayHeading, isCalendarDate, shiftDate } from "@/lib/time";

// A date input holds YYYY-MM-DD, or nothing while it isn't a whole date.
const goToSchema = z.object({
  date: z.string().refine(isCalendarDate, "Choose a date."),
});
type GoToFields = z.infer<typeof goToSchema>;

interface DayNavProps {
  /** The day shown, as YYYY-MM-DD on the restaurant's calendar. */
  date: string;
  today: string;
  /** Where a day lives, such as ?date=2026-11-14. Days are links, so Back returns to the last. */
  hrefFor: (date: string) => To;
  /** Opens the day chosen in "Go to a date". */
  onGoTo: (date: string) => void;
  /** 2 on the page. 4 in /design's specimens. */
  headingLevel?: 2 | 4;
}

/**
 * The top of a day's page: the date as the book would head it, the days on either side, and a way
 * to jump to any date. Picking a date doesn't open it straight away, because a date input changes
 * with each digit typed, so it waits for Show.
 */
export function DayNav({
  date,
  today,
  hrefFor,
  onGoTo,
  headingLevel = 2,
}: DayNavProps): ReactElement {
  const Heading = headingLevel === 2 ? "h2" : "h4";
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GoToFields>({ resolver: zodResolver(goToSchema), values: { date } });

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {date === today && <p className="text-eyebrow text-accent uppercase">Today</p>}
        <Heading className="font-display text-title">{formatDayHeading(date, today)}</Heading>
        <nav aria-label="Days" className="mt-1 flex flex-wrap gap-x-6">
          <LinkButton variant="link" to={hrefFor(shiftDate(date, -1))}>
            Previous day
          </LinkButton>
          {date !== today && (
            <LinkButton variant="link" to={hrefFor(today)}>
              Today
            </LinkButton>
          )}
          <LinkButton variant="link" to={hrefFor(shiftDate(date, 1))}>
            Next day
          </LinkButton>
        </nav>
      </div>
      <form
        noValidate
        onSubmit={handleSubmit(({ date: chosen }) => onGoTo(chosen))}
        className="flex items-start gap-3"
      >
        <Input
          type="date"
          label="Go to a date"
          error={errors.date?.message}
          className="w-44"
          {...register("date")}
        />
        {/* Level with the field, below its label. */}
        <Button type="submit" variant="ghost" className="mt-5.5">
          Show
        </Button>
      </form>
    </div>
  );
}
