import type { BadgeTone } from "@/components/Badge";
import type { Figure } from "@/components/Figures";
import type { OpeningHours, OwnerReservation, ReservationStatus, TableZone } from "@/types/api";

// The words an owner sees for the API's values. A Record needs every value, so a new status or zone
// in types/api.ts can't be shown without a label.
export const STATUS_LABELS: Record<ReservationStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  ARRIVED: "Arrived",
  NO_SHOW: "No-show",
  CANCELLED: "Cancelled",
};

// The restaurant's colors, as the export's dashboard has them: waiting in amber, confirmed in blue,
// seated in green, a no-show grey and a cancellation red. The word always comes with the color, so
// the color is never the only signal.
export const STATUS_TONES: Record<ReservationStatus, BadgeTone> = {
  PENDING: "warning",
  CONFIRMED: "info",
  ARRIVED: "success",
  NO_SHOW: "neutral",
  CANCELLED: "error",
};

// The guest's colors, as the export's My reservations has them: a confirmed table is the good news,
// in green, and a visit that's over is grey.
export const GUEST_STATUS_TONES: Record<ReservationStatus, BadgeTone> = {
  PENDING: "warning",
  CONFIRMED: "success",
  ARRIVED: "neutral",
  NO_SHOW: "neutral",
  CANCELLED: "error",
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
 * The day at a glance, as the export's four figures: the guests expected, the bookings waiting to be
 * confirmed, the guests seated, and the no-shows. Only for a day whose bookings are all on one
 * page, because the counts would otherwise be wrong.
 */
export function dayFigures(reservations: OwnerReservation[], isToday: boolean): Figure[] {
  const count = (status: ReservationStatus): number =>
    reservations.filter((reservation) => reservation.status === status).length;
  const guests = reservations
    .filter((reservation) => HOLDING_STATUSES.includes(reservation.status))
    .reduce((sum, reservation) => sum + reservation.partySize, 0);
  const seated = count("ARRIVED");
  return [
    { label: "Guests expected", value: String(guests), note: "not counting cancellations" },
    { label: "To confirm", value: String(count("PENDING")), note: "waiting for you" },
    {
      label: "Seated",
      value: String(seated),
      note: reservations.length === 1 ? "of 1 booking" : `of ${reservations.length} bookings`,
    },
    { label: "No-shows", value: String(count("NO_SHOW")), note: isToday ? "today" : "that day" },
  ];
}

/** A day's opening hours in words, for under the day's name: "Open 12:00 – 15:00, 18:00 – 23:00". */
export function dayHoursWords(hours: OpeningHours[], weekday: number): string {
  const shifts = hours
    .filter((shift) => shift.dayOfWeek === weekday)
    .sort((a, b) => a.opensAt - b.opensAt);
  if (shifts.length === 0) return "Closed";
  return `Open ${shifts.map(({ opens, closes }) => `${opens} – ${closes}`).join(", ")}`;
}
