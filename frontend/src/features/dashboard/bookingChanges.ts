import { z } from "zod";

import type { OwnerReservation, ReservationStatus, RestaurantChange } from "@/types/api";

/** The order a booking's changes are offered in: the usual next step first, cancelling last. */
export const CHANGE_ORDER: readonly RestaurantChange[] = [
  "CONFIRMED",
  "ARRIVED",
  "NO_SHOW",
  "CANCELLED",
];

/** Each change's button, saying what it does. */
export const CHANGE_LABELS: Record<RestaurantChange, string> = {
  CONFIRMED: "Confirm",
  ARRIVED: "Mark arrived",
  NO_SHOW: "Mark no-show",
  CANCELLED: "Cancel",
};

/** A change's button for one booking: cancelling one still waiting is declining it, as the export says. */
export function changeLabel(change: RestaurantChange, status: ReservationStatus): string {
  return change === "CANCELLED" && status === "PENDING" ? "Decline" : CHANGE_LABELS[change];
}

/** A change to send: the status, and for a cancellation, an optional reason the guest sees. */
export interface BookingChange {
  status: RestaurantChange;
  reason?: string;
}

/** What a change did, said back once the server has saved it. */
export function changeDoneWords({ status, guest, starts }: OwnerReservation): string {
  switch (status) {
    case "CONFIRMED":
      return `${guest.name}’s booking at ${starts} is confirmed.`;
    case "ARRIVED":
      return `${guest.name} is marked as arrived.`;
    case "NO_SHOW":
      return `${guest.name}’s booking at ${starts} is marked as a no-show.`;
    case "CANCELLED":
      return `${guest.name}’s booking at ${starts} is cancelled.`;
    case "PENDING":
      // No change leads back to pending, so this is never said.
      return `${guest.name}’s booking at ${starts} is waiting to be confirmed.`;
  }
}

/** The reason for a cancellation: optional, as the API takes it. */
export const cancelReasonSchema = z.object({
  reason: z.string().trim().max(200, "Use 200 characters or fewer."),
});

export type CancelReasonFields = z.input<typeof cancelReasonSchema>;
