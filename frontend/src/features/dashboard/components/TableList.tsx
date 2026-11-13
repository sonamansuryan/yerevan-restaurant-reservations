import type { ReactElement } from "react";

import { PencilIcon } from "@/components/icons";
import { RefusalNotice } from "@/features/dashboard/components/RefusalNotice";
import { ZONE_LABELS } from "@/features/dashboard/labels";
import { guestRange, tableCode, tableName, tablesByZone } from "@/features/dashboard/tables";
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
  className?: string;
}

/**
 * Every table in one white panel, as the export's "All tables": a square with its short name, its
 * name and the parties it takes, its area, whether it's bookable online, and a pencil to change it.
 * The tables come by area, and in each area in the order they were added. Switching one off keeps
 * it on the list, greyed, so it can be switched back on.
 */
export function TableList({
  tables,
  onEdit,
  onSwitch,
  switchingId = null,
  refusal = null,
  headingLevel = 3,
  className,
}: TableListProps): ReactElement {
  const Heading = headingLevel === 3 ? "h3" : "h4";
  const ordered = tablesByZone(tables).flatMap(({ tables: area }) => area);
  return (
    <section
      className={cx(
        "min-w-0 overflow-hidden rounded-band border border-line bg-surface-raised",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <Heading className="text-body font-semibold">All tables</Heading>
        <span className="text-meta text-ink-secondary">Bookable online</span>
      </div>
      <ul>
        {ordered.map((table) => (
          <li key={table.id} className="border-b border-line-soft px-5 py-3 last:border-b-0">
            <div className="flex items-center gap-3.5">
              <span
                aria-hidden="true"
                className={cx(
                  "grid size-11 flex-none place-items-center rounded-card bg-fill-hover text-ui font-bold",
                  !table.isActive && "text-ink-muted",
                )}
              >
                {tableCode(table.label)}
              </span>
              <p className={cx("min-w-0 flex-1", !table.isActive && "text-ink-muted")}>
                <span className="block text-input font-semibold break-words">
                  {tableName(table.label)} ·{" "}
                  <span className="tabular-nums">{guestRange(table)}</span>
                </span>
                <span className="block text-meta text-ink-secondary">
                  {ZONE_LABELS[table.zone]}
                  {!table.isActive && " · switched off"}
                </span>
              </p>
              <label className="flex flex-none cursor-pointer items-center gap-2 text-meta text-ink-secondary has-disabled:cursor-progress">
                <input
                  type="checkbox"
                  checked={table.isActive}
                  disabled={switchingId === table.id}
                  onChange={() => onSwitch(table)}
                  className="size-4.5 cursor-pointer accent-success-strong disabled:cursor-progress"
                />
                Active<span className="sr-only">, {table.label}</span>
              </label>
              <button
                type="button"
                aria-label={`Edit ${table.label}`}
                onClick={() => onEdit(table)}
                className="grid size-10 flex-none place-items-center rounded-chip border border-line bg-surface-raised text-ink transition-[border-color] duration-button hover:border-ink any-pointer-coarse:size-11"
              >
                <PencilIcon />
              </button>
            </div>
            {refusal?.tableId === table.id && (
              <RefusalNotice error={refusal.error} className="mt-3 mb-1" />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
