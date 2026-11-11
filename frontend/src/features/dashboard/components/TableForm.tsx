import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import type { ReactElement } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { useServerFieldErrors } from "@/features/auth/hooks/useServerFieldErrors";
import { RefusalNotice } from "@/features/dashboard/components/RefusalNotice";
import { ZONE_LABELS } from "@/features/dashboard/labels";
import { SEAT_COUNTS, TABLE_FIELDS, ZONES, tableFormSchema } from "@/features/dashboard/tables";
import type { TableFields, TableRequest } from "@/features/dashboard/tables";
import type { ApiError } from "@/lib/api";

// A taken name belongs under the Name field, not above the form.
const LABEL_TAKEN = "TABLE_LABEL_TAKEN";

interface TableFormProps {
  values: TableFields;
  onSubmit: (request: TableRequest) => void;
  onCancel: () => void;
  /** Says what the button does: "Add the table", or "Save table". */
  submitLabel: string;
  pending?: boolean;
  /** What the server said last, if it said no. */
  error?: ApiError | null;
  /** For /design: showing the fields' problems at once. */
  validateOnMount?: boolean;
}

/**
 * A table's details, for a new table or an existing one. It checks the server's rules first, in
 * the server's words. Fewer seats than a booked party is refused by the server, which lists the
 * bookings above the fields.
 */
export function TableForm({
  values,
  onSubmit,
  onCancel,
  submitLabel,
  pending = false,
  error = null,
  validateOnMount = false,
}: TableFormProps): ReactElement {
  const {
    register,
    handleSubmit,
    setError,
    trigger,
    formState: { errors },
  } = useForm<TableFields, unknown, TableRequest>({
    resolver: zodResolver(tableFormSchema),
    values,
  });

  useServerFieldErrors(error, setError, TABLE_FIELDS);
  useEffect(() => {
    if (error?.code === LABEL_TAKEN) {
      setError("label", { type: "server", message: error.message }, { shouldFocus: true });
    }
  }, [error, setError]);
  useEffect(() => {
    if (validateOnMount) void trigger();
  }, [validateOnMount, trigger]);

  return (
    // noValidate: the browser's own bubbles would come before these messages, in its own words.
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <RefusalNotice error={error} shownElsewhere={[LABEL_TAKEN]} />
      <Input
        label="Name"
        autoComplete="off"
        hint={errors.label ? undefined : "A short name, such as T4 or Terrace 2."}
        error={errors.label?.message}
        {...register("label")}
      />
      <div className="grid gap-6 sm:grid-cols-2">
        <Select
          label="Seats"
          hint={errors.capacity ? undefined : "The most guests it takes."}
          error={errors.capacity?.message}
          {...register("capacity")}
        >
          {SEAT_COUNTS.map((count) => (
            <option key={count} value={String(count)}>
              {count}
            </option>
          ))}
        </Select>
        <Select
          label="Fewest guests"
          hint={errors.minCapacity ? undefined : "Smaller parties get another table."}
          error={errors.minCapacity?.message}
          {...register("minCapacity")}
        >
          {SEAT_COUNTS.map((count) => (
            <option key={count} value={String(count)}>
              {count}
            </option>
          ))}
        </Select>
      </div>
      <Select label="Area" error={errors.zone?.message} {...register("zone")}>
        {ZONES.map((zone) => (
          <option key={zone} value={zone}>
            {ZONE_LABELS[zone]}
          </option>
        ))}
      </Select>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
