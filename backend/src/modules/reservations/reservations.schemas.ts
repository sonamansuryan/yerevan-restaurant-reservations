import { z } from "zod";

import { MAX_SEATS } from "../tables/tables.schemas.ts";

const TABLE = "Choose a table.";
const DATE = "Choose a date, such as 2026-11-20.";
const TIME = "Choose a time, such as 19:30.";
const GUESTS = `Choose how many guests, from 1 to ${MAX_SEATS}.`;
const REQUESTS = "Use 500 characters or fewer.";

/**
 * POST /api/reservations: a table, and a date and time the restaurant offers, on its own clock.
 * The guest comes from the session and the restaurant from the table, so neither is sent.
 */
export const createReservationSchema = z.object({
  tableId: z.uuid({ error: TABLE }),
  date: z.iso.date({ error: DATE }),
  time: z.iso.time({ precision: -1, error: TIME }),
  partySize: z.number({ error: GUESTS }).int(GUESTS).min(1, GUESTS).max(MAX_SEATS, GUESTS),
  specialRequests: z
    .string({ error: REQUESTS })
    .trim()
    .max(500, REQUESTS)
    .transform((text) => text || null)
    .optional(),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;
