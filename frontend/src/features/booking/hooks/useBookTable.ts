import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationResult } from "@tanstack/react-query";

import { apiPost } from "@/lib/api";
import type { ApiError } from "@/lib/api";
import type { GuestReservation, GuestReservationResponse } from "@/types/api";

/** What POST /api/reservations takes: a table, and a date and time the restaurant offers. */
export interface BookingRequest {
  tableId: string;
  date: string;
  time: string;
  partySize: number;
  specialRequests?: string;
}

/** Books a table for the signed-in guest. It's pending until the restaurant confirms it. */
export function useBookTable(
  slug: string,
): UseMutationResult<GuestReservation, ApiError, BookingRequest> {
  const queryClient = useQueryClient();
  return useMutation<GuestReservation, ApiError, BookingRequest>({
    mutationFn: async (request) =>
      (await apiPost<GuestReservationResponse>("/api/reservations", request)).reservation,
    // Booked or refused, the free tables have changed: this booking took one, or someone else did.
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["availability", slug] }),
  });
}
