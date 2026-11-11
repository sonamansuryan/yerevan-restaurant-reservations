import { z } from "zod";

import { pagingFields } from "../../lib/paging.ts";
import { parseLocalDateTime } from "./blocks.rules.ts";

/** More current and upcoming blocks than any restaurant has, so one page holds them all. */
export const BLOCK_PAGE_SIZE = 100;

const DATE = "Choose a date, such as 2026-11-20.";
const LOCAL_TIME = "Choose a date and a time on the quarter hour, such as 2026-11-20T18:00.";

/** GET /blocks: the blocks that aren't over yet, a page at a time like every list. */
export const blockListSchema = z.object(pagingFields(BLOCK_PAGE_SIZE, BLOCK_PAGE_SIZE));

/** /blocks/:blockId. Block ids are UUIDs, so anything else is refused before the database is asked. */
export const blockIdSchema = z.object({
  blockId: z.uuid({ error: "Choose a block." }),
});

// An optional detail left empty, or only spaces, means "none".
const blankIsNull = (value: unknown): unknown =>
  typeof value === "string" ? value.trim() || null : value;

const localTime = z
  .string({ error: LOCAL_TIME })
  .refine((text) => parseLocalDateTime(text) !== null, LOCAL_TIME);

/**
 * POST /blocks. One table, or the whole restaurant when tableId is left out. Then either a whole
 * date, or a time range from one local date and time to another, in the restaurant's own time:
 * { date: "2026-12-31" }, or { from: "2026-11-20T18:00", to: "2026-11-21T02:00" }.
 */
export const createBlockSchema = z
  .object({
    tableId: z.uuid({ error: "Choose a table." }).nullable().optional(),
    date: z.iso.date({ error: DATE }).optional(),
    from: localTime.optional(),
    to: localTime.optional(),
    reason: z.preprocess(
      blankIsNull,
      z
        .string({ error: "Enter a reason." })
        .max(200, "Use 200 characters or fewer.")
        .nullable()
        .optional(),
    ),
  })
  .superRefine(({ date, from, to }, ctx) => {
    if (date !== undefined) {
      if (from !== undefined || to !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["date"],
          message: "Choose a whole date, or a time range, not both.",
        });
      }
      return;
    }
    if (from === undefined) {
      ctx.addIssue({ code: "custom", path: ["from"], message: "Choose when the block starts." });
    }
    if (to === undefined) {
      ctx.addIssue({ code: "custom", path: ["to"], message: "Choose when the block ends." });
    }
    // Both are "YYYY-MM-DDTHH:MM" in the same time zone, so text order is time order. The
    // service checks the exact moments again.
    if (from !== undefined && to !== undefined && to <= from) {
      ctx.addIssue({ code: "custom", path: ["to"], message: "End the block after it starts." });
    }
  });

export type BlockListQuery = z.infer<typeof blockListSchema>;
export type BlockIdParams = z.infer<typeof blockIdSchema>;
export type CreateBlockInput = z.infer<typeof createBlockSchema>;
