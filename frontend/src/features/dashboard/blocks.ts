import { z } from "zod";

import { QUARTER_HOURS, clockTime } from "@/features/dashboard/hours";
import { ZONE_LABELS } from "@/features/dashboard/labels";
import { tableName } from "@/features/dashboard/tables";
import { formatDayHeading, isCalendarDate, shiftDate, yerevanToday } from "@/lib/time";
import type { OwnerBlock } from "@/types/api";

/** A block's times are quarter hours, written as the API takes them: "00:00" to "23:45". */
export const BLOCK_TIMES = QUARTER_HOURS.map(clockTime);

const DATE = "Choose a date.";

/**
 * The block form: the whole restaurant or one table, then a whole day or a time range. Every
 * field is always there, so switching between the choices keeps what was typed; only the chosen
 * ones are checked and sent. The times come from a list, so they're always on the quarter hour.
 */
export const blockFormSchema = z
  .object({
    scope: z.enum(["restaurant", "table"]),
    tableId: z.string(),
    kind: z.enum(["day", "range"]),
    date: z.string(),
    fromDate: z.string(),
    fromTime: z.string(),
    toDate: z.string(),
    toTime: z.string(),
    reason: z.string().trim().max(200, "Use 200 characters or fewer."),
  })
  .superRefine((fields, ctx) => {
    if (fields.scope === "table" && !fields.tableId) {
      ctx.addIssue({ code: "custom", path: ["tableId"], message: "Choose a table." });
    }
    if (fields.kind === "day") {
      if (!isCalendarDate(fields.date)) {
        ctx.addIssue({ code: "custom", path: ["date"], message: DATE });
      }
      return;
    }
    for (const field of ["fromDate", "toDate"] as const) {
      if (!isCalendarDate(fields[field])) {
        ctx.addIssue({ code: "custom", path: [field], message: DATE });
      }
    }
    // Written "2026-11-20T18:00" on the same clock, so text order is time order.
    const from = `${fields.fromDate}T${fields.fromTime}`;
    const to = `${fields.toDate}T${fields.toTime}`;
    if (isCalendarDate(fields.fromDate) && isCalendarDate(fields.toDate) && to <= from) {
      ctx.addIssue({ code: "custom", path: ["toDate"], message: "End the block after it starts." });
    }
  })
  .transform((fields): BlockRequest => {
    const what = fields.scope === "table" ? { tableId: fields.tableId } : {};
    const why = fields.reason ? { reason: fields.reason } : {};
    return fields.kind === "day"
      ? { ...what, date: fields.date, ...why }
      : {
          ...what,
          from: `${fields.fromDate}T${fields.fromTime}`,
          to: `${fields.toDate}T${fields.toTime}`,
          ...why,
        };
  });

/**
 * What's sent: a table, or none for the whole restaurant, then a whole date or a time range in
 * the restaurant's own time, such as { from: "2026-11-20T18:00", to: "2026-11-21T02:00" }.
 */
export type BlockRequest = { tableId?: string; reason?: string } & (
  { date: string } | { from: string; to: string }
);
export type BlockFields = z.input<typeof blockFormSchema>;

/** The form's fields that the server's messages belong to, by the server's own names. */
export const BLOCK_FIELD_FOR = {
  tableId: "tableId",
  date: "date",
  from: "fromDate",
  to: "toDate",
  reason: "reason",
} as const satisfies Record<string, keyof BlockFields>;

/** A new block: the whole restaurant, for today, or an evening, if a time range is chosen. */
export function newBlock(today: string): BlockFields {
  return {
    scope: "restaurant",
    tableId: "",
    kind: "day",
    date: today,
    fromDate: today,
    fromTime: "18:00",
    toDate: today,
    toTime: "23:00",
    reason: "",
  };
}

/**
 * When a block is, as the list shows it: its days, and its times or "All day". A block that ends
 * at midnight ends with the day before, so 18:00 until 00:00 is one evening.
 */
export function blockWhen(
  { starts, ends }: Pick<OwnerBlock, "starts" | "ends">,
  today: string = yerevanToday(),
): { days: string; times: string } {
  const lastDay = ends.time === "00:00" ? shiftDate(ends.date, -1) : ends.date;
  const first = formatDayHeading(starts.date, today);
  const days = lastDay === starts.date ? first : `${first} – ${formatDayHeading(lastDay, today)}`;
  const allDay = starts.time === "00:00" && ends.time === "00:00";
  return { days, times: allDay ? "All day" : `${starts.time}–${ends.time}` };
}

/** What a block covers: "Whole restaurant", or "Table T4 · Terrace". */
export function blockWhat({ table }: Pick<OwnerBlock, "table">): string {
  return table ? `${tableName(table.label)} · ${ZONE_LABELS[table.zone]}` : "Whole restaurant";
}

/** How a day stands on the blocks calendar: blocked for the whole restaurant, or only partly. */
export type BlockedDay = "whole" | "partial";

/**
 * The days the blocks touch, for the calendar, by YYYY-MM-DD: "whole" when the whole restaurant is
 * blocked from midnight to midnight, "partial" when only some hours or some tables are. A block
 * ending at 00:00 ends with the day before. The whole day wins when blocks overlap.
 */
export function blockedDays(blocks: OwnerBlock[]): Map<string, BlockedDay> {
  const days = new Map<string, BlockedDay>();
  for (const block of blocks) {
    const last = block.ends.time === "00:00" ? shiftDate(block.ends.date, -1) : block.ends.date;
    // A year at most, so a block far into the future can't make this run on.
    for (
      let date = block.starts.date, step = 0;
      date <= last && step < 366;
      date = shiftDate(date, 1), step += 1
    ) {
      const fromMidnight = date > block.starts.date || block.starts.time === "00:00";
      const toMidnight = block.ends.date >= shiftDate(date, 1);
      const kind: BlockedDay =
        block.table === null && fromMidnight && toMidnight ? "whole" : "partial";
      if (days.get(date) !== "whole") days.set(date, kind);
    }
  }
  return days;
}
