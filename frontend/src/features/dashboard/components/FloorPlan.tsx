import type { ReactElement } from "react";

import { ZONE_LABELS } from "@/features/dashboard/labels";
import { tablesByZone } from "@/features/dashboard/tables";
import type { TableNow } from "@/features/dashboard/tables";
import { cx } from "@/lib/cx";
import type { OwnerTable } from "@/types/api";

interface FloorPlanProps {
  tables: OwnerTable[];
  /** How each table stands now (tableNow). */
  statusFor: (table: OwnerTable) => TableNow;
  /** 3 on the page, under the part's heading. 4 in /design's specimens. */
  headingLevel?: 3 | 4;
  className?: string;
}

// Each status's look, as the export's floor plan has them: free in a green line, reserved in blue,
// seated in wine, blocked and switched off as dashed outlines. The words always come with them.
const LOOKS: Record<TableNow["kind"], string> = {
  free: "border-2 border-success-strong bg-surface-raised text-ink",
  reserved: "bg-info text-on-dark",
  seated: "bg-accent text-on-accent",
  blocked: "border-2 border-dashed border-line-rule bg-neutral-soft text-ink-secondary",
  off: "border-2 border-dashed border-line-strong bg-surface-tinted text-ink-muted",
};

const LEGEND: { kind: TableNow["kind"]; label: string; swatch: string }[] = [
  { kind: "free", label: "Free", swatch: "border-2 border-success-strong bg-surface-raised" },
  { kind: "reserved", label: "Reserved", swatch: "bg-info" },
  { kind: "seated", label: "Seated", swatch: "bg-accent" },
  {
    kind: "blocked",
    label: "Blocked",
    swatch: "border-2 border-dashed border-line-rule bg-neutral-soft",
  },
];

/** What a table's status says, short, under its name: "free", "18:30", "seated", "blocked". */
function statusWords(status: TableNow): { short: string; long: string } {
  switch (status.kind) {
    case "free":
      return { short: "free", long: "free now" };
    case "reserved":
      return { short: status.at, long: `reserved at ${status.at}` };
    case "seated":
      return { short: "seated", long: `seated until ${status.until}` };
    case "blocked":
      return { short: "blocked", long: `blocked until ${status.until}` };
    case "off":
      return { short: "off", long: "switched off" };
  }
}

// A table's shape by the guests it seats: a round two-top, then wider tables for bigger parties.
function shapeOf(capacity: number): string {
  if (capacity <= 2) return "size-21 rounded-pill";
  if (capacity <= 4) return "h-21 w-37.5 rounded-hero";
  return "h-22.5 w-55 rounded-hero";
}

/**
 * The restaurant's tables as the export's floor plan: each area in its own dashed box, each table a
 * shape sized by the guests it seats, colored by how it stands now. It isn't a true plan, because
 * Seghan doesn't know where tables stand, only their area. Screen readers hear each table's name,
 * seats and status in words.
 */
export function FloorPlan({
  tables,
  statusFor,
  headingLevel = 3,
  className,
}: FloorPlanProps): ReactElement {
  const Heading = headingLevel === 3 ? "h3" : "h4";
  const areas = tablesByZone(tables);
  return (
    <section
      className={cx(
        "flex min-w-0 flex-col gap-4 rounded-band border border-line bg-surface-raised p-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Heading className="text-body font-semibold">Floor plan</Heading>
        <ul
          aria-hidden="true"
          className="flex flex-wrap gap-x-3.5 gap-y-1 text-caption text-ink-secondary"
        >
          {LEGEND.map(({ kind, label, swatch }) => (
            <li key={kind} className="flex items-center gap-1.5">
              <span className={cx("size-3 rounded-check", swatch)} />
              {label}
            </li>
          ))}
        </ul>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {areas.map(({ zone, tables: area }) => (
          <div
            key={zone}
            className={cx(
              "flex min-h-40 flex-col gap-3 rounded-hero border border-dashed border-line-strong p-3.5",
              // An area alone, or with many tables, takes the whole width, as the export's main
              // hall does.
              (areas.length === 1 || area.length > 3) && "sm:col-span-2",
            )}
          >
            <p className="text-caption font-semibold tracking-label text-ink-secondary uppercase">
              {ZONE_LABELS[zone]}
            </p>
            <ul className="flex flex-wrap items-center gap-4">
              {area.map((table) => {
                const status = statusFor(table);
                const words = statusWords(status);
                return (
                  <li
                    key={table.id}
                    className={cx(
                      "flex flex-col items-center justify-center px-2 text-center",
                      shapeOf(table.capacity),
                      LOOKS[status.kind],
                    )}
                  >
                    <span className="max-w-full truncate text-ui font-bold">{table.label}</span>
                    <span aria-hidden="true" className="text-caption">
                      {table.capacity} · {words.short}
                    </span>
                    <span className="sr-only">
                      , {table.capacity === 1 ? "1 seat" : `${table.capacity} seats`}, {words.long}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
