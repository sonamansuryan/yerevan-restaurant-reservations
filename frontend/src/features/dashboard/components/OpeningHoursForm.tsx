import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useId } from "react";
import type { ReactElement } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import type { Control, UseFormClearErrors, UseFormRegister } from "react-hook-form";

import { Button } from "@/components/Button";
import { FieldError } from "@/components/Field";
import { controlClass } from "@/components/field-styles";
import { FormNotice } from "@/components/FormNotice";
import { ChevronDownIcon } from "@/components/icons";
import { ServerNotice } from "@/features/auth/components/ServerNotice";
import {
  OPENINGS_PER_DAY,
  QUARTER_HOURS,
  clockTime,
  closesNextDay,
  newOpening,
  openingMessages,
  weekFormSchema,
  weekMessage,
} from "@/features/dashboard/hours";
import type { WeekFields, WeekRequest } from "@/features/dashboard/hours";
import { DAY_NAMES, WEEK } from "@/features/restaurants/openingHours";
import type { ApiError } from "@/lib/api";
import { cx } from "@/lib/cx";

// The opening times are the same 96 quarter hours for every opening, so they're made once.
const OPENS_OPTIONS = QUARTER_HOURS.map((minutes) => (
  <option key={minutes} value={String(minutes)}>
    {clockTime(minutes)}
  </option>
));

interface OpeningRowProps {
  index: number;
  day: string;
  control: Control<WeekFields, unknown, WeekRequest>;
  register: UseFormRegister<WeekFields>;
  clearErrors: UseFormClearErrors<WeekFields>;
  /** The server's message about this opening, such as "Overlaps Monday 12:00–15:00." */
  error: string | undefined;
  onRemove: () => void;
}

/**
 * One opening, on one line as the export has it: when it opens, a dash, when it closes, and Remove.
 * Each time is named for screen readers, "Monday opens" and "Monday closes", as the day leads the
 * line. It watches only its own two times, so a change redraws this row, not the whole week.
 */
function OpeningRow({
  index,
  day,
  control,
  register,
  clearErrors,
  error,
  onRemove,
}: OpeningRowProps): ReactElement {
  const opensName = `hours.${index}.opens` as const;
  const closesName = `hours.${index}.closes` as const;
  const [opens, closes] = useWatch({ control, name: [opensName, closesName] });
  const opensAt = Number(opens);
  const errorId = useId();
  const select = cx(
    "h-10 cursor-pointer appearance-none pr-8",
    controlClass({ invalid: Boolean(error), disabled: false }),
  );

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="relative">
          <select
            aria-label={`${day} opens`}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={select}
            {...register(opensName)}
          >
            {OPENS_OPTIONS}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-ink-muted" />
        </span>
        <span aria-hidden="true" className="text-ink-secondary">
          –
        </span>
        <span className="relative">
          <select
            aria-label={`${day} closes`}
            // The message is about the whole opening, so both its times are marked.
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={select}
            // A change to either time answers the server's message about this opening.
            {...register(closesName, { onChange: () => clearErrors(opensName) })}
          >
            {QUARTER_HOURS.map((minutes) => (
              <option key={minutes} value={String(minutes)}>
                {clockTime(minutes)}
                {closesNextDay(opensAt, minutes) ? " (next day)" : ""}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-ink-muted" />
        </span>
        <Button
          variant="link"
          aria-label={`Remove, ${day} ${clockTime(opensAt)} to ${clockTime(Number(closes))}`}
          onClick={onRemove}
          className="ml-1"
        >
          Remove
        </Button>
      </div>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}

interface OpeningHoursFormProps {
  /** The form's id, so the page's Save changes, up in its header, can send it. */
  id?: string;
  /** The week as saved. New values, such as the week after a save, reset the form. */
  values: WeekFields;
  onSubmit: (request: WeekRequest) => void;
  /** What the server said last, if it said no. */
  error?: ApiError | null;
  /** The last save worked. It's said until something changes. */
  saved?: boolean;
}

/**
 * The whole week, Monday first, saved at once, as the export's "Weekly opening hours": a line a day,
 * its name, whether it's open, and its hours. A day has up to three openings; ticking Open gives it
 * one, and unticking it closes the day. The times are quarter hours, and a closing at or before the
 * opening is the next day's, so every pair of times is a real opening. Only overlaps are left for
 * the server to find: its messages appear under the openings they're about. The page's header
 * holds Save changes, which sends this form by its id.
 */
export function OpeningHoursForm({
  id,
  values,
  onSubmit,
  error = null,
  saved = false,
}: OpeningHoursFormProps): ReactElement {
  const {
    control,
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isDirty },
  } = useForm<WeekFields, unknown, WeekRequest>({
    resolver: zodResolver(weekFormSchema),
    values,
  });
  const { fields, append, remove } = useFieldArray({ control, name: "hours" });
  const formId = useId();

  // The server names each opening by its place in the list sent, which is the form's own order.
  useEffect(() => {
    let first = true;
    for (const [index, message] of openingMessages(error)) {
      setError(`hours.${index}.opens`, { type: "server", message }, { shouldFocus: first });
      first = false;
    }
  }, [error, setError]);

  const weekProblem = errors.hours?.root?.message ?? errors.hours?.message ?? weekMessage(error);
  const showSaved = saved && !isDirty && !error;

  return (
    <form
      id={id}
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="flex max-w-180 flex-col gap-4"
    >
      {(error || weekProblem || showSaved) && (
        <div className="flex flex-col gap-3">
          {weekProblem ? (
            <FormNotice tone="error">{weekProblem}</FormNotice>
          ) : (
            <ServerNotice error={error} />
          )}
          {showSaved && <FormNotice tone="success">Opening hours saved.</FormNotice>}
        </div>
      )}
      <p className="text-ui text-ink-secondary">
        A closing time at or before the opening time is the next day’s, such as 18:00 to 02:00.
      </p>

      <section className="overflow-hidden rounded-band border border-line bg-surface-raised">
        <h3 className="border-b border-line px-5 py-4 text-body font-semibold">
          Weekly opening hours
        </h3>
        {WEEK.map((dayOfWeek) => {
          const day = DAY_NAMES[dayOfWeek] ?? "";
          const dayId = `${formId}-day-${dayOfWeek}`;
          const openings = fields
            .map((field, index) => ({ field, index }))
            .filter(({ field }) => field.dayOfWeek === dayOfWeek);
          return (
            <div
              key={dayOfWeek}
              role="group"
              aria-labelledby={dayId}
              className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-line-soft px-5 py-2.5 last:border-b-0"
            >
              <p id={dayId} className="flex h-10 w-27 items-center text-input font-semibold">
                {day}
              </p>
              <label className="flex h-10 w-22 cursor-pointer items-center gap-2 text-ui">
                <input
                  type="checkbox"
                  checked={openings.length > 0}
                  onChange={(event) =>
                    event.target.checked
                      ? append(newOpening(dayOfWeek, true))
                      : remove(openings.map(({ index }) => index))
                  }
                  className="size-4.5 cursor-pointer accent-success-strong"
                />
                Open <span className="sr-only">on {day}</span>
              </label>
              {/* On a phone the times take a line of their own, under the day and Open. */}
              <div className="flex w-full min-w-0 flex-col items-start gap-2 sm:w-auto sm:flex-1">
                {openings.length === 0 && (
                  <p className="flex h-10 items-center text-ui text-ink-secondary">
                    No bookings this day
                  </p>
                )}
                {openings.map(({ field, index }) => (
                  <OpeningRow
                    key={field.id}
                    index={index}
                    day={day}
                    control={control}
                    register={register}
                    clearErrors={clearErrors}
                    error={errors.hours?.[index]?.opens?.message}
                    onRemove={() => remove(index)}
                  />
                ))}
                {openings.length > 0 && openings.length < OPENINGS_PER_DAY && (
                  <Button
                    variant="link"
                    aria-label={`Add another opening, ${day}`}
                    onClick={() => append(newOpening(dayOfWeek, false))}
                  >
                    Add another opening
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </form>
  );
}
