import { useId } from "react";
import type { ReactElement } from "react";

import { bestFit, seatsLabel } from "@/features/booking/booking";
import { ZONE_LABELS } from "@/features/dashboard/labels";
import type { AvailableTable } from "@/types/api";

interface TableChoiceProps {
  time: string;
  tables: AvailableTable[];
  chosen: string | null;
  onChoose: (tableId: string) => void;
}

// Numbered tables read in order: T2 before T10.
const byName = (a: AvailableTable, b: AvailableTable): number =>
  a.label.localeCompare(b.label, "en", { numeric: true });

/**
 * The tables free at the chosen time, as the export lists them: one white box each, its name, its
 * area and seats, and "Best fit" on the smallest that takes the party. The chosen box takes a wine
 * line, as the chosen time is wine. They're real radios, kept out of sight: the arrow keys move
 * between them, and the focus ring goes round the whole box. Names are in sans, because a name is
 * usually a code, such as T1.
 */
export function TableChoice({ time, tables, chosen, onChoose }: TableChoiceProps): ReactElement {
  // Its own name, so two pickers on one page, as in /design, don't share one group of radios.
  const name = useId();
  const best = bestFit(tables);

  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-2 text-ui font-semibold text-ink">Available tables at {time}</legend>
      {[...tables].sort(byName).map((table) => (
        <label
          key={table.id}
          className="flex min-h-touch cursor-pointer items-center justify-between gap-3 rounded-hero border border-line bg-surface-raised px-3.5 py-3 transition-[border-color,box-shadow] duration-150 hover:border-ink has-checked:border-accent has-checked:ring-1 has-checked:ring-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
        >
          <input
            type="radio"
            name={name}
            value={table.id}
            checked={table.id === chosen}
            onChange={() => onChoose(table.id)}
            className="sr-only"
          />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-input font-semibold break-words text-ink">{table.label}</span>{" "}
            {/* The spaces keep the parts apart when the box's words are read out as one name. */}
            <span className="text-meta text-ink-secondary">
              {ZONE_LABELS[table.zone]} · {seatsLabel(table.capacity)}
            </span>
          </span>
          {table.id === best && tables.length > 1 && " "}
          {table.id === best && tables.length > 1 && (
            <span className="flex-none text-caption font-semibold text-success-strong">
              Best fit
            </span>
          )}
        </label>
      ))}
    </fieldset>
  );
}
