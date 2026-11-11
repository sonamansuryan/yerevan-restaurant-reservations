import type { ApiError } from "@/lib/api";
import type { OwnerReservation } from "@/types/api";

/**
 * The bookings a refused change lists in its details, if it lists any: 409 TABLE_HAS_BOOKINGS,
 * TABLE_TOO_SMALL and BLOCK_HAS_BOOKINGS (BookingsInTheWayDetails). Empty for any other error.
 */
export function bookingsInTheWay(error: ApiError | null): OwnerReservation[] {
  const details: unknown = error?.details;
  if (typeof details !== "object" || details === null || !("reservations" in details)) return [];
  return Array.isArray(details.reservations) ? (details.reservations as OwnerReservation[]) : [];
}
