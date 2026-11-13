// The rules for bookings that need no database.
import type { ReservationStatus } from "../../generated/prisma/enums.ts";

/** Statuses that occupy a table. Must match the WHERE clause of "Reservation_no_overlap". */
export const ACTIVE_STATUSES: ReservationStatus[] = ["PENDING", "CONFIRMED", "ARRIVED"];

/** The statuses a guest can cancel from (PROJECT_PLAN.md §5.3). */
export const GUEST_CANCELLABLE: ReservationStatus[] = ["PENDING", "CONFIRMED"];

/**
 * Whether the guest can still cancel a booking: it's pending or confirmed, and it hasn't started.
 * At the start time itself it's too late. Statuses only move forward, so an arrived, no-show or
 * cancelled booking never can.
 */
export function canGuestCancel(
  booking: { status: ReservationStatus; startsAt: Date },
  now: Date,
): boolean {
  return GUEST_CANCELLABLE.includes(booking.status) && now < booking.startsAt;
}

/** Whether the guest can review the booking: they arrived, and haven't reviewed it yet. */
export function canGuestReview(booking: { status: ReservationStatus }, reviewed: boolean): boolean {
  return booking.status === "ARRIVED" && !reviewed;
}

/** The statuses a restaurant can move its bookings to. */
export const RESTAURANT_CHANGES = ["CONFIRMED", "CANCELLED", "ARRIVED", "NO_SHOW"] as const;
export type RestaurantChange = (typeof RESTAURANT_CHANGES)[number];

/**
 * The statuses each of the restaurant's changes may come from (PROJECT_PLAN.md §5.3). Statuses
 * only move forward: nothing leads back to pending, and arrived, no-show and cancelled are final.
 * A confirmed booking can still be cancelled, by either side, so a confirm can be followed by a
 * cancel, but never the other way round. A guest can arrive before the restaurant has confirmed,
 * so arrived may come from pending too, but only while the booking is on.
 */
export const RESTAURANT_CHANGES_FROM: Record<RestaurantChange, ReservationStatus[]> = {
  CONFIRMED: ["PENDING"],
  CANCELLED: ["PENDING", "CONFIRMED"],
  ARRIVED: ["PENDING", "CONFIRMED"],
  NO_SHOW: ["CONFIRMED"],
};

/** A guest can be marked arrived from this many minutes before their booking starts. */
export const EARLY_ARRIVAL_MINUTES = 30;

/** Why the restaurant can't make a change: the booking's status, or the time. */
export type ChangeProblem = "WRONG_STATUS" | "TOO_EARLY" | "TOO_LATE";

/**
 * The first reason the restaurant can't make this change to the booking now, or null if it can.
 * The status comes first, because a booking that has moved on never changes back, whatever the
 * time. Then the time (§5.3):
 * - confirming: before the start
 * - cancelling: any time
 * - arrived: from 30 minutes before the start for a confirmed booking. A pending one only while
 *   it's on: before that, the restaurant confirms it first, and once it's over, it's too late.
 * - no-show: after the start
 */
export function restaurantChangeProblem(
  booking: { status: ReservationStatus; startsAt: Date; endsAt: Date },
  change: RestaurantChange,
  now: Date,
): ChangeProblem | null {
  if (!RESTAURANT_CHANGES_FROM[change].includes(booking.status)) return "WRONG_STATUS";

  const start = booking.startsAt.getTime();
  const at = now.getTime();
  if (change === "CONFIRMED" && at >= start) return "TOO_LATE";
  if (change === "ARRIVED" && booking.status === "PENDING") {
    if (at < start) return "WRONG_STATUS";
    if (at >= booking.endsAt.getTime()) return "TOO_LATE";
  }
  if (change === "ARRIVED" && at < start - EARLY_ARRIVAL_MINUTES * 60_000) return "TOO_EARLY";
  if (change === "NO_SHOW" && at <= start) return "TOO_EARLY";
  return null;
}
