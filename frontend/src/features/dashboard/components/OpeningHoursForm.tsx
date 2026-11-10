import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useId } from "react";
import type { ReactElement } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import type { Control, UseFormClearErrors, UseFormRegister } from "react-hook-form";

import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { Select } from "@/components/Select";
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
 * One opening: when it opens, when it closes, and Remove. It watches only its own two times, so a
 * change redraws this row, not the whole week.
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

  return (
    <div className="grid w-full max-w-120 grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] items-start gap-x-3">
      <Select
        label="Opens"
        error={error}
        // The message is about the whole opening, so it runs on under Closes in one line,
        // instead of breaking in this narrow column.
        className="[&>p]:whitespace-nowrap"
        {...register(opensName)}
      >
        {OPENS_OPTIONS}
      </Select>
      <Select
        label="Closes"
        // A change to either time answers the server's message about this opening.
        {...register(closesName, { onChange: () => clearErrors(opensName) })}
      >
        {QUARTER_HOURS.map((minutes) => (
          <option key={minutes} value={String(minutes)}>
            {clockTime(minutes)}
            {closesNextDay(opensAt, minutes) ? " (next day)" : ""}
          </option>
        ))}
      </Select>
      <Button
        variant="link"
        aria-label={`Remove, ${day} ${clockTime(opensAt)} to ${clockTime(Number(closes))}`}
        onClick={onRemove}
        // As tall as the times beside it, so it sits level with them on every screen.
        className="mt-5 h-11"
      >
        Remove
      </Button>
    </div>
  );
}

interface OpeningHoursFormProps {
  /** The week as saved. New values, such as the week after a save, reset the form. */
  values: WeekFields;
  onSubmit: (request: WeekRequest) => void;
  pending?: boolean;
  /** What the server said last, if it said no. */
  error?: ApiError | null;
  /** The last save worked. It's said until something changes. */
  saved?: boolean;
}

/**
 * The whole week, Monday first, saved at once. Each day has up to three openings, and a day with
 * none is closed. The times are quarter hours, and a closing at or before the opening is the next
 * day's, so every pair of times is a real opening. Only overlaps are left for the server to find:
 * its messages appear under the openings they're about.
 */
export function OpeningHoursForm({
  values,
  onSubmit,
  pending = false,
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
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex max-w-160 flex-col gap-6">
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

      <div className="border-t border-line">
        {WEEK.map((dayOfWeek) => {
          const day = DAY_NAMES[dayOfWeek] ?? "";
          const dayId = `${formId}-day-${dayOfWeek}`;
          const openings = fields
            .map((field, index) => ({ field, index }))
            .filter(({ field }) => field.dayOfWeek === dayOfWeek);
          const adding = openings.length === 0 ? "Add opening hours" : "Add another opening";
          return (
            <div
              key={dayOfWeek}
              role="group"
              aria-labelledby={dayId}
              className="grid gap-x-8 gap-y-3 border-b border-line py-5 sm:grid-cols-[8rem_minmax(0,1fr)]"
            >
              <p id={dayId} className="font-display text-title-xs sm:pt-6">
                {day}
              </p>
              <div className="flex flex-col items-start gap-4">
                {openings.length === 0 && <p className="text-ui text-ink-muted sm:pt-7">Closed</p>}
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
                {openings.length < OPENINGS_PER_DAY && (
                  <Button
                    variant="link"
                    aria-label={`${adding}, ${day}`}
                    onClick={() => append(newOpening(dayOfWeek, openings.length === 0))}
                  >
                    {adding}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <Button type="submit" loading={pending}>
          Save opening hours
        </Button>
      </div>
    </form>
  );
}
