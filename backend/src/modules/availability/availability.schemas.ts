import { z } from "zod";

import { MAX_SEATS } from "../tables/tables.schemas.ts";

const DATE = "Choose a date, such as 2026-11-20.";
const GUESTS = `Choose how many guests, from 1 to ${MAX_SEATS}.`;

/**
 * GET /api/restaurants/:slug/availability?date=2026-11-20&partySize=2. The date is a day on the
 * restaurant's own calendar. No table seats more than MAX_SEATS, so no bigger party could fit.
 * Anything else in the query is dropped.
 */
export const availabilityQuerySchema = z.object({
  date: z.iso.date({ error: DATE }),
  partySize: z.coerce.number({ error: GUESTS }).int(GUESTS).min(1, GUESTS).max(MAX_SEATS, GUESTS),
});

export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
