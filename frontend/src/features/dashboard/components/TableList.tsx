import type { ReactElement } from "react";

import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { RefusalNotice } from "@/features/dashboard/components/RefusalNotice";
import { ZONE_LABELS } from "@/features/dashboard/labels";
import { guestRange, tablesByZone } from "@/features/dashboard/tables";
import type { ApiError } from "@/lib/api";
import { cx } from "@/lib/cx";
import type { OwnerTable } from "@/types/api";

interface TableListProps {
  tables: OwnerTable[];
  onEdit: (table: OwnerTable) => void;
  /** Switches a table off, or back on. */
  onSwitch: (table: OwnerTable) => void;
  /** The table whose switch is being sent. */
  switchingId?: string | null;
  /** A switch the server refused. It shows under that table's line. */
  refusal?: { tableId: string; error: ApiError } | null;
  /** 3 on the page. 4 in /design's specimens. */
  headingLevel?: 3 | 4;
}

/**
 * The tables by area, as lines on a printed menu: the name, a dotted line, and the parties it
 * takes. An inactive table stays in its area, greyed and marked, so it can be switched back on.
 */
export function TableList({
  tables,
  onEdit,
  onSwitch,
  switchingId = null,
  refusal = null,
  headingLevel = 3,
}: TableListProps): ReactElement {
  const Heading = headingLevel === 3 ? "h3" : "h4";
  return (
    <div className="flex flex-col gap-8">
      {tablesByZone(tables).map(({ zone, tables: area }) => (
        <section key={zone}>
          <Heading className="text-eyebrow text-ink-muted uppercase">{ZONE_LABELS[zone]}</Heading>
          <ul className="mt-2 border-t border-line">
            {area.map((table) => (
              <li key={table.id} className="border-b border-line py-3">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                  <p
                    className={cx(
                      "flex min-w-0 flex-1 basis-56 items-baseline gap-2",
                      table.isActive ? "text-ink" : "text-ink-muted",
                    )}
                  >
                    {/* Sans, not serif: a name is often a code, and the serif 1 reads like an l (T1, P1). */}
                    <span className="text-ui font-medium break-words">{table.label}</span>
                    <span aria-hidden="true" className="menu-leader" />
                    <span className="text-ui tabular-nums">{guestRange(table)}</span>
                  </p>
                  {!table.isActive && <Badge tone="neutral">Inactive</Badge>}
                  <div className="flex gap-x-6">
                    <Button
                      variant="link"
                      aria-label={`Edit ${table.label}`}
                      onClick={() => onEdit(table)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="link"
                      aria-label={`${table.isActive ? "Deactivate" : "Activate"} ${table.label}`}
                      loading={switchingId === table.id}
                      onClick={() => onSwitch(table)}
                    >
                      {table.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </div>
                {refusal?.tableId === table.id && (
                  <RefusalNotice error={refusal.error} className="mt-3 mb-1 max-w-160" />
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
