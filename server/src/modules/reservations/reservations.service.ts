import type { ReservationStatus } from "../../generated/prisma/client.ts";

/** Statuses that occupy a table. Must match the WHERE clause of "Reservation_no_overlap". */
export const ACTIVE_STATUSES: ReservationStatus[] = ["PENDING", "CONFIRMED", "ARRIVED"];
