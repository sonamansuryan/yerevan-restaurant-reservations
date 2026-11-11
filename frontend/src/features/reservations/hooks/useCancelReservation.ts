import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationResult } from "@tanstack/react-query";

import { apiPatch } from "@/lib/api";
import type { ApiError } from "@/lib/api";
import type { GuestReservation, GuestReservationResponse } from "@/types/api";

/** Cancels one of the guest's bookings, while it's still pending or confirmed and hasn't started. */
export function useCancelReservation(): UseMutationResult<
  GuestReservation,
  ApiError,
  GuestReservation
> {
  const queryClient = useQueryClient();
  return useMutation<GuestReservation, ApiError, GuestReservation>({
    mutationFn: async (booking) =>
      (
        await apiPatch<GuestReservationResponse>(
          `/api/reservations/${encodeURIComponent(booking.id)}`,
          { status: "CANCELLED" },
        )
      ).reservation,
    // Cancelled or refused, the lists show the bookings as they are now. A cancelled table is free
    // again, so that restaurant's free tables are asked for again too.
    onSettled: (_reply, _error, booking) => {
      void queryClient.invalidateQueries({ queryKey: ["reservations"] });
      void queryClient.invalidateQueries({ queryKey: ["availability", booking.restaurant.slug] });
    },
  });
}
