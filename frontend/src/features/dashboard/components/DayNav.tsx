import { zodResolver } from "@hookform/resolvers/zod";
import { useId } from "react";
import type { ReactElement } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import type { To } from "react-router";
import { z } from "zod";

import { Button } from "@/components/Button";
import { FieldError } from "@/components/Field";
import { controlClass } from "@/components/field-styles";
import { ArrowLeftIcon, ArrowRightIcon } from "@/components/icons";
import { cx } from "@/lib/cx";
import { isCalendarDate, shiftDate } from "@/lib/time";

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
  /** Opens the day chosen in "Go to". */
  onGoTo: (date: string) => void;
}

// The three parts of one white control, as the export joins them: earlier, today, later.
const part =
  "grid min-w-11 place-items-center px-3 text-ui font-semibold text-ink transition-[background-color] duration-button hover:bg-fill-hover aria-[current=page]:bg-fill-slot";

/**
 * Moving between days, as the export's dashboard has it: one white control with the day before,
 * Today, and the day after, then a date to go to. Picking a date doesn't open it straight away,
 * because a date input changes with each digit typed, so it waits for Show. The day shown is said in
 * the part's heading above.
 */
export function DayNav({ date, today, hrefFor, onGoTo }: DayNavProps): ReactElement {
  const errorId = useId();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GoToFields>({ resolver: zodResolver(goToSchema), values: { date } });

  return (
    <div className="flex flex-wrap items-start gap-2">
      <nav
        aria-label="Days"
        className="flex h-11 overflow-hidden rounded-control border border-line-strong bg-surface-raised"
      >
        <Link to={hrefFor(shiftDate(date, -1))} aria-label="Previous day" className={part}>
          <ArrowLeftIcon />
        </Link>
        <Link
          to={hrefFor(today)}
          aria-current={date === today ? "page" : undefined}
          className={cx(part, "border-x border-line-strong")}
        >
          Today
        </Link>
        <Link to={hrefFor(shiftDate(date, 1))} aria-label="Next day" className={part}>
          <ArrowRightIcon />
        </Link>
      </nav>
      <form
        noValidate
        onSubmit={handleSubmit(({ date: chosen }) => onGoTo(chosen))}
        className="flex flex-col"
      >
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-ui whitespace-nowrap text-ink-secondary">
            Go to
            <input
              type="date"
              aria-invalid={errors.date ? true : undefined}
              aria-describedby={errors.date ? errorId : undefined}
              className={cx(
                "h-11 w-40 pr-2",
                controlClass({ invalid: Boolean(errors.date), disabled: false }),
              )}
              {...register("date")}
            />
          </label>
          <Button type="submit" variant="ghost">
            Show
          </Button>
        </div>
        {errors.date?.message && <FieldError id={errorId}>{errors.date.message}</FieldError>}
      </form>
    </div>
  );
}
