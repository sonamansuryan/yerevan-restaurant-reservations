// Bookings as the owner's day view reads them (src/modules/reservations/owner.service.ts).
import type {
  CancelledBy,
  ReservationStatus,
  TableZone,
} from "../../src/generated/prisma/enums.ts";
import type { TableBooking } from "../../src/modules/availability/availability.rules.ts";

/** A Reservation row with what the day view selects. */
export interface DayReservationRow {
  id: string;
  status: ReservationStatus;
  partySize: number;
  startsAt: Date;
  endsAt: Date;
  specialRequests: string | null;
  cancelledBy: CancelledBy | null;
  cancellationReason: string | null;
  table: { id: string; label: string; zone: TableZone };
  user: { name: string };
}

/** Aram's table for four at T4, on Friday 13 November 2026 from 18:00 to 20:00 in Yerevan. */
export function dayReservationRow(extra: Partial<DayReservationRow> = {}): DayReservationRow {
  return {
    id: "b7c8d9e0-1f2a-4b3c-8d4e-5f6a7b8c9d0e",
    status: "CONFIRMED",
    partySize: 4,
    startsAt: new Date("2026-11-13T14:00:00.000Z"),
    endsAt: new Date("2026-11-13T16:00:00.000Z"),
    specialRequests: null,
    cancelledBy: null,
    cancellationReason: null,
    table: { id: "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f", label: "T4", zone: "INDOOR" },
    user: { name: "Aram Petrosyan" },
    ...extra,
  };
}

/**
 * A booking as the free-table check reads it (src/modules/availability/availability.rules.ts):
 * Lilit's at Lori Smokehouse's T1, on Saturday 14 November 2026 from 19:00 to 21:00 in Yerevan.
 */
export function tableBooking(extra: Partial<TableBooking> = {}): TableBooking {
  return {
    tableId: "4f3e2d1c-0b9a-4876-9543-210fedcba987",
    status: "CONFIRMED",
    startsAt: new Date("2026-11-14T15:00:00.000Z"),
    endsAt: new Date("2026-11-14T17:00:00.000Z"),
    ...extra,
  };
}
