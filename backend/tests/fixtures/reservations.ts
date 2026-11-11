// Bookings as the owner's day view reads them (src/modules/reservations/owner.service.ts).
import type {
  CancelledBy,
  ReservationStatus,
  TableZone,
} from "../../src/generated/prisma/enums.ts";
import type { TableBooking } from "../../src/modules/availability/availability.rules.ts";
import type { CreateReservationInput } from "../../src/modules/reservations/reservations.schemas.ts";
import type { GuestReservation } from "../../src/modules/reservations/reservations.service.ts";

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

/** What a guest sends to book Lori Smokehouse's T1 for two, on the demo Saturday at 19:00. */
export const bookingRequest: CreateReservationInput = {
  tableId: "4f3e2d1c-0b9a-4876-9543-210fedcba987",
  date: "2026-11-14",
  time: "19:00",
  partySize: 2,
};

/** What that booking answers: pending, from 19:00 to 21:00 in Yerevan. */
export const guestReservation: GuestReservation = {
  id: "d1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a",
  status: "PENDING",
  partySize: 2,
  date: "2026-11-14",
  startsAt: "2026-11-14T15:00:00.000Z",
  endsAt: "2026-11-14T17:00:00.000Z",
  starts: "19:00",
  ends: "21:00",
  restaurant: { slug: "lori-smokehouse", name: "Lori Smokehouse" },
  table: { label: "T1", zone: "INDOOR" },
  specialRequests: null,
};
