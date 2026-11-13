import { z } from "zod";

import { blankIsMissing } from "../../lib/paging.ts";
import type { AnalyticsDays } from "./analytics.rules.ts";

// Everything in an address arrives as text, so the choice is checked as text, then turned into its
// number.
const PERIODS = ["7", "30", "90"] as const;
const DAYS: Record<(typeof PERIODS)[number], AnalyticsDays> = { "7": 7, "30": 30, "90": 90 };

/** GET …/analytics?days=: the last 7, 30 or 90 days, today included, and 30 unless asked. */
export const analyticsQuerySchema = z.object({
  days: z.preprocess(
    blankIsMissing,
    z
      .enum(PERIODS, { error: "Choose 7, 30 or 90 days." })
      .transform((days) => DAYS[days])
      .default(30),
  ),
});

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
