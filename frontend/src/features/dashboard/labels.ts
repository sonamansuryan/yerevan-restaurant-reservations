import type { BadgeTone } from "@/components/Badge";
import type { OwnerReservation, ReservationStatus, TableZone } from "@/types/api";

// The words an owner sees for the API's values. A Record needs every value, so a new status or zone
// in types/api.ts can't be shown without a label.
export const STATUS_LABELS: Record<ReservationStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  ARRIVED: "Arrived",
  NO_SHOW: "No-show",
  CANCELLED: "Cancelled",
};

// The word always comes with the dot, so the color is never the only signal.
export const STATUS_TONES: Record<ReservationStatus, BadgeTone> = {
  PENDING: "warning",
  CONFIRMED: "success",
  ARRIVED: "info",
  NO_SHOW: "error",
  CANCELLED: "neutral",
};

/** The statuses that hold a table, so their guests are expected (PROJECT_PLAN.md §5.3). */
export const HOLDING_STATUSES: readonly ReservationStatus[] = ["PENDING", "CONFIRMED", "ARRIVED"];

export const ZONE_LABELS: Record<TableZone, string> = {
  INDOOR: "Indoor",
  TERRACE: "Terrace",
  VIP: "VIP",
  BAR_COUNTER: "Bar counter",
};

/** "1 guest", "4 guests". */
export function guestsWords(count: number): string {
  return count === 1 ? "1 guest" : `${count} guests`;
}

/** "Cancelled by the guest", with the reason after it when one was given. */
export function cancellationWords(
  cancellation: NonNullable<OwnerReservation["cancellation"]>,
): string {
  const who =
    cancellation.by === "CUSTOMER"
      ? "Cancelled by the guest"
      : cancellation.by === "RESTAURANT"
        ? "Cancelled by the restaurant"
        : "Cancelled";
  return cancellation.reason ? `${who}: ${cancellation.reason}` : who;
}

/**
 * The day at a glance: the guests expected, then how many bookings have each status, such as
 * "12 guests · 3 confirmed · 1 pending · 1 cancelled". Only for a day whose bookings are all on
 * this page, because the count would otherwise be wrong.
 */
export function daySummary(reservations: OwnerReservation[]): string {
  const guests = reservations
    .filter((reservation) => HOLDING_STATUSES.includes(reservation.status))
    .reduce((sum, reservation) => sum + reservation.partySize, 0);
  const order: ReservationStatus[] = ["CONFIRMED", "PENDING", "ARRIVED", "NO_SHOW", "CANCELLED"];
  const counts = order
    .map((status) => ({
      status,
      count: reservations.filter((reservation) => reservation.status === status).length,
    }))
    .filter(({ count }) => count > 0)
    .map(({ status, count }) => `${count} ${STATUS_LABELS[status].toLowerCase()}`);
  return [guests > 0 ? guestsWords(guests) : null, ...counts].filter(Boolean).join(" · ");
}
