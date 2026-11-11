import type { GuestReservation, ReservationStatus } from "@/types/api";

/** Which of the guest's bookings a page lists: the ones not over yet, or the ones that are. */
export type ReservationsWhen = "upcoming" | "past";

/** A page of the guest's bookings: /reservations or /reservations/past, then ?page= after the first. */
export function reservationsPath(when: ReservationsWhen, page = 1): string {
  const path = when === "upcoming" ? "/reservations" : "/reservations/past";
  return page > 1 ? `${path}?page=${page}` : path;
}

/** The page asked for in the address. Anything but a whole number from 1 means the first. */
export function pageFrom(params: URLSearchParams): number {
  const page = Number(params.get("page"));
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/** One day's bookings, in the order they came. */
export interface BookingDay {
  date: string;
  bookings: GuestReservation[];
}

/**
 * The bookings under their days, as a diary lists them. They come in time order, so a day's
 * bookings are next to each other, and a day split between two pages starts again on the next.
 */
export function byDay(reservations: GuestReservation[]): BookingDay[] {
  const days: BookingDay[] = [];
  for (const booking of reservations) {
    const last = days.at(-1);
    if (last?.date === booking.date) last.bookings.push(booking);
    else days.push({ date: booking.date, bookings: [booking] });
  }
  return days;
}

// The words a guest sees for their own bookings. The restaurant's book says "Pending" and
// "No-show". The guest is told what it means for them. A Record needs every status.
export const GUEST_STATUS_LABELS: Record<ReservationStatus, string> = {
  PENDING: "Waiting for the restaurant",
  CONFIRMED: "Confirmed",
  ARRIVED: "Arrived",
  NO_SHOW: "Missed",
  CANCELLED: "Cancelled",
};

/** "Cancelled by you", or "Cancelled by the restaurant", with its reason after it when it gave one. */
export function guestCancellationWords(
  cancellation: NonNullable<GuestReservation["cancellation"]>,
): string {
  const who =
    cancellation.by === "CUSTOMER"
      ? "Cancelled by you"
      : cancellation.by === "RESTAURANT"
        ? "Cancelled by the restaurant"
        : "Cancelled";
  return cancellation.reason ? `${who}: ${cancellation.reason}` : who;
}

/** "1 booking", "3 bookings". */
export function bookingsWords(count: number): string {
  return count === 1 ? "1 booking" : `${count} bookings`;
}
