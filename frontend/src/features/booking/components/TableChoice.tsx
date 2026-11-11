import { useId } from "react";
import type { ReactElement } from "react";

import { ChoiceRadio } from "@/components/ChoiceLines";
import { seatsLabel } from "@/features/booking/booking";
import { ZONE_LABELS } from "@/features/dashboard/labels";
import { tablesByZone } from "@/features/dashboard/tables";
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
 * The tables free at the chosen time, by area, as lines on a menu. Names are in sans, because a
 * name is usually a code, and the serif 1 reads like an l.
 */
export function TableChoice({ time, tables, chosen, onChoose }: TableChoiceProps): ReactElement {
  // Its own name, so two pickers on one page, as in /design, don't share one group of radios.
  const name = useId();

  return (
    <fieldset className="flex min-w-0 flex-col gap-4">
      <legend className="mb-4 text-meta font-medium text-ink-secondary">Table at {time}</legend>
      {tablesByZone(tables).map(({ zone, tables: area }) => (
        <div key={zone}>
          <p className="text-eyebrow text-ink-muted uppercase">{ZONE_LABELS[zone]}</p>
          <div className="mt-1 border-t border-line">
            {[...area].sort(byName).map((table) => (
              <label
                key={table.id}
                className="flex min-h-touch cursor-pointer items-baseline gap-3 border-b border-line py-3"
              >
                <ChoiceRadio
                  name={name}
                  value={table.id}
                  checked={table.id === chosen}
                  onChange={() => onChoose(table.id)}
                />
                <span className="text-ui font-medium">{table.label}</span>{" "}
                <span aria-hidden="true" className="menu-leader" />
                <span className="text-meta text-ink-muted">{seatsLabel(table.capacity)}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </fieldset>
  );
}
