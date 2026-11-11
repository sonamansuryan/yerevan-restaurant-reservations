import { z } from "zod";

import { pagingFields } from "../../lib/paging.ts";
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

/** A guest's bookings on one page, unless they ask for another size. */
export const RESERVATION_PAGE_SIZE = 20;
export const MAX_RESERVATION_PAGE_SIZE = 50;

// A value left empty in the address, such as ?when=, means "not given", not a mistake.
const blankIsMissing = (value: unknown): unknown => (value === "" ? undefined : value);

/**
 * GET /api/reservations?when=upcoming|past, with pages like every list. Upcoming bookings aren't
 * over yet, and past ones are, whatever their status. Upcoming is the default.
 */
export const guestReservationListSchema = z.object({
  when: z.preprocess(
    blankIsMissing,
    z.enum(["upcoming", "past"], { error: "Choose upcoming or past." }).default("upcoming"),
  ),
  ...pagingFields(RESERVATION_PAGE_SIZE, MAX_RESERVATION_PAGE_SIZE),
});

export type GuestReservationListQuery = z.infer<typeof guestReservationListSchema>;

/** /api/reservations/:reservationId. Booking ids are UUIDs, so anything else is refused here. */
export const reservationIdSchema = z.object({
  reservationId: z.uuid({ error: "Choose a booking." }),
});

export type ReservationIdParams = z.infer<typeof reservationIdSchema>;

/**
 * PATCH /api/reservations/:reservationId. A guest's only change to a booking is cancelling it, so
 * the body must say exactly that: { "status": "CANCELLED" }.
 */
export const cancelReservationSchema = z.object({
  status: z.literal("CANCELLED", { error: "A guest can only cancel a booking." }),
});
