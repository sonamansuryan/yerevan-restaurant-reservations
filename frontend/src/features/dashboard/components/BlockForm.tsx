import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import type { ReactElement } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/Button";
import { ChoiceLines } from "@/components/ChoiceLines";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { fieldMessages } from "@/features/auth/serverErrors";
import { RefusalNotice } from "@/features/dashboard/components/RefusalNotice";
import { BLOCK_FIELD_FOR, BLOCK_TIMES, blockFormSchema } from "@/features/dashboard/blocks";
import type { BlockFields, BlockRequest } from "@/features/dashboard/blocks";
import { ZONE_LABELS } from "@/features/dashboard/labels";
import { guestRange } from "@/features/dashboard/tables";
import type { ApiError } from "@/lib/api";
import type { OwnerTable } from "@/types/api";

const scopes = [
  { value: "restaurant", label: "The whole restaurant", note: "No table can be booked" },
  { value: "table", label: "One table", note: "The others stay open" },
];

const kinds = [
  { value: "day", label: "A whole day", note: "Midnight to midnight" },
  { value: "range", label: "A time range", note: "Across midnight, or several days" },
];

interface BlockFormProps {
  /** The tables that can be blocked: the active ones. */
  tables: OwnerTable[];
  values: BlockFields;
  onSubmit: (request: BlockRequest) => void;
  onCancel: () => void;
  pending?: boolean;
  /** What the server said last, if it said no. */
  error?: ApiError | null;
  /** For /design: showing the fields' problems at once. */
  validateOnMount?: boolean;
}

/**
 * A new block: the whole restaurant or one table, then a whole day or a time range, in the
 * restaurant's own time. Bookings inside it are refused by the server, which lists them at the
 * top. Switching between the choices keeps what was typed.
 */
export function BlockForm({
  tables,
  values,
  onSubmit,
  onCancel,
  pending = false,
  error = null,
  validateOnMount = false,
}: BlockFormProps): ReactElement {
  const {
    register,
    handleSubmit,
    setError,
    trigger,
    control,
    formState: { errors },
  } = useForm<BlockFields, unknown, BlockRequest>({
    resolver: zodResolver(blockFormSchema),
    values,
  });
  const [scope, kind] = useWatch({ control, name: ["scope", "kind"] });

  // The server names its fields "from" and "to"; here they're the start and end dates.
  useEffect(() => {
    const messages = fieldMessages(error);
    let first = true;
    for (const [serverField, field] of Object.entries(BLOCK_FIELD_FOR)) {
      const message = messages[serverField];
      if (!message) continue;
      setError(field, { type: "server", message }, { shouldFocus: first });
      first = false;
    }
  }, [error, setError]);
  useEffect(() => {
    if (validateOnMount) void trigger();
  }, [validateOnMount, trigger]);

  return (
    // noValidate: the browser's own bubbles would come before these messages, in its own words.
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <RefusalNotice error={error} />
      <ChoiceLines legend="Block" options={scopes} {...register("scope")} />
      {scope === "table" && (
        <Select label="Table" error={errors.tableId?.message} {...register("tableId")}>
          <option value="" disabled>
            Choose a table
          </option>
          {tables.map((table) => (
            <option key={table.id} value={table.id}>
              {table.label} · {ZONE_LABELS[table.zone]} · {guestRange(table)}
            </option>
          ))}
        </Select>
      )}
      <ChoiceLines legend="When" options={kinds} {...register("kind")} />
      {kind === "day" ? (
        <Input type="date" label="Date" error={errors.date?.message} {...register("date")} />
      ) : (
        <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-x-4 gap-y-6">
          <Input
            type="date"
            label="Start date"
            error={errors.fromDate?.message}
            {...register("fromDate")}
          />
          <Select label="Start time" {...register("fromTime")}>
            {BLOCK_TIMES.map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </Select>
          <Input
            type="date"
            label="End date"
            error={errors.toDate?.message}
            {...register("toDate")}
          />
          <Select label="End time" {...register("toTime")}>
            {BLOCK_TIMES.map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </Select>
        </div>
      )}
      <Input
        label="Reason"
        autoComplete="off"
        hint={errors.reason ? undefined : "Optional. Guests don’t see it."}
        error={errors.reason?.message}
        {...register("reason")}
      />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Button type="submit" loading={pending}>
          Block this time
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
