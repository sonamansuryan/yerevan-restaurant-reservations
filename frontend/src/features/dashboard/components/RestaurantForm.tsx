import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useId } from "react";
import type { ReactElement } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/Button";
import { Checkbox } from "@/components/Checkbox";
import { FieldError } from "@/components/Field";
import { FormNotice } from "@/components/FormNotice";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { ServerNotice } from "@/features/auth/components/ServerNotice";
import { useServerFieldErrors } from "@/features/auth/hooks/useServerFieldErrors";
import { FormPart } from "@/features/dashboard/components/FormPart";
import {
  BOOKING_LENGTHS,
  CUISINES,
  DISTRICTS,
  RESTAURANT_FIELDS,
  lengthWords,
  restaurantFormSchema,
} from "@/features/dashboard/schemas";
import type { RestaurantFields, RestaurantRequest } from "@/features/dashboard/schemas";
import {
  CUISINE_LABELS,
  DISTRICT_LABELS,
  PRICE_LEVELS,
  priceSigns,
  priceWords,
} from "@/features/restaurants/labels";
import type { ApiError } from "@/lib/api";
import { cx } from "@/lib/cx";

const MAX_CUISINES = 3;

interface RestaurantFormProps {
  /** What the fields hold: a blank form, or the restaurant as saved. New values reset the form. */
  values: RestaurantFields;
  onSubmit: (request: RestaurantRequest) => void;
  /** Says what the button does, such as "Add the restaurant" or "Save changes". */
  submitLabel: string;
  pending?: boolean;
  /** What the server said last, if it said no. */
  error?: ApiError | null;
  /** The last save worked. It's said until something changes. */
  saved?: boolean;
  /** For /design: showing the fields' problems at once. */
  validateOnMount?: boolean;
  headingLevel?: 3 | 4;
}

/**
 * A restaurant's details, for a new restaurant or an existing one. It checks the fields with the
 * server's rules first, and receives the server's state as props, so /design can show every state.
 */
export function RestaurantForm({
  values,
  onSubmit,
  submitLabel,
  pending = false,
  error = null,
  saved = false,
  validateOnMount = false,
  headingLevel = 3,
}: RestaurantFormProps): ReactElement {
  const {
    register,
    handleSubmit,
    setError,
    trigger,
    control,
    formState: { errors, isDirty },
  } = useForm<RestaurantFields, unknown, RestaurantRequest>({
    resolver: zodResolver(restaurantFormSchema),
    // `values`, rather than defaultValues: after a save, the restaurant as saved fills the form.
    values,
  });

  useServerFieldErrors(error, setError, RESTAURANT_FIELDS);
  useEffect(() => {
    if (validateOnMount) void trigger();
  }, [validateOnMount, trigger]);

  // Once three cuisines are ticked, the others wait, so the limit can't be broken by accident.
  const chosen = useWatch({ control, name: "cuisines" });
  const chosenList: unknown[] = Array.isArray(chosen) ? chosen : [];
  const full = chosenList.length >= MAX_CUISINES;

  const cuisinesId = useId();
  const cuisinesError = errors.cuisines?.message;

  return (
    // noValidate: the browser's own bubbles would come before these messages, in its own words.
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex max-w-180 flex-col gap-6">
      {(error || (saved && !isDirty)) && (
        <div className="flex flex-col gap-3">
          <ServerNotice error={error} />
          {saved && !isDirty && !error && <FormNotice tone="success">Changes saved.</FormNotice>}
        </div>
      )}

      <FormPart title="About" headingLevel={headingLevel}>
        <Input label="Name" autoComplete="off" error={errors.name?.message} {...register("name")} />
        <Textarea
          label="Description"
          rows={4}
          hint={errors.description ? undefined : "Optional. Guests read it on your page."}
          error={errors.description?.message}
          {...register("description")}
        />
        <fieldset
          aria-describedby={cx(cuisinesError && `${cuisinesId}-error`, `${cuisinesId}-hint`)}
          className="flex min-w-0 flex-col"
        >
          <legend className="text-ui font-semibold text-ink">Cuisines</legend>
          <p id={`${cuisinesId}-hint`} className="mt-0.5 text-meta text-ink-muted">
            Choose up to {MAX_CUISINES}.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-x-6 md:grid-cols-3 md:gap-y-3">
            {CUISINES.map((cuisine) => (
              <Checkbox
                key={cuisine}
                label={CUISINE_LABELS[cuisine]}
                value={cuisine}
                disabled={full && !chosenList.includes(cuisine)}
                {...register("cuisines")}
              />
            ))}
          </div>
          {cuisinesError && <FieldError id={`${cuisinesId}-error`}>{cuisinesError}</FieldError>}
        </fieldset>
        <Select label="Price" error={errors.priceLevel?.message} {...register("priceLevel")}>
          <option value="" disabled>
            Choose a price
          </option>
          {PRICE_LEVELS.map((level) => (
            <option key={level} value={String(level)}>
              {priceSigns(level)} {priceWords(level)}
            </option>
          ))}
        </Select>
      </FormPart>

      <FormPart title="Location and contact" headingLevel={headingLevel}>
        <Select label="District" error={errors.district?.message} {...register("district")}>
          <option value="" disabled>
            Choose a district
          </option>
          {DISTRICTS.map((district) => (
            <option key={district} value={district}>
              {DISTRICT_LABELS[district]}
            </option>
          ))}
        </Select>
        <Input
          label="Address"
          autoComplete="off"
          hint={errors.address ? undefined : "Such as 12 Abovyan Street."}
          error={errors.address?.message}
          {...register("address")}
        />
        <div className="grid gap-6 sm:grid-cols-2">
          <Input
            label="Phone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            hint={errors.phone ? undefined : "Optional."}
            error={errors.phone?.message}
            {...register("phone")}
          />
          <Input
            label="Website"
            type="url"
            inputMode="url"
            autoComplete="off"
            hint={errors.website ? undefined : "Optional."}
            error={errors.website?.message}
            {...register("website")}
          />
        </div>
      </FormPart>

      <FormPart title="Bookings" headingLevel={headingLevel}>
        <div className="grid gap-6 sm:grid-cols-2">
          <Select
            label="Start times"
            hint={errors.slotIntervalMin ? undefined : "How often guests can choose a time."}
            error={errors.slotIntervalMin?.message}
            {...register("slotIntervalMin")}
          >
            <option value="15">Every 15 minutes</option>
            <option value="30">Every 30 minutes</option>
          </Select>
          <Select
            label="Booking length"
            hint={
              errors.reservationDurationMin ? undefined : "How long each booking holds its table."
            }
            error={errors.reservationDurationMin?.message}
            {...register("reservationDurationMin")}
          >
            {BOOKING_LENGTHS.map((minutes) => (
              <option key={minutes} value={String(minutes)}>
                {lengthWords(minutes)}
              </option>
            ))}
          </Select>
        </div>
      </FormPart>

      <div>
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
