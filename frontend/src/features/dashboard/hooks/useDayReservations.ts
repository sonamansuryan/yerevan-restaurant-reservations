import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";

import type { BookingChange } from "@/features/dashboard/bookingChanges";
import { ownerKeys, ownerRestaurantPath } from "@/features/dashboard/queryKeys";
import { apiGet, apiPatch } from "@/lib/api";
import type { ApiError } from "@/lib/api";
import type { ListResponse, OwnerReservation, OwnerReservationResponse } from "@/types/api";

/** How often an open day is asked for again, so new bookings and others' changes show up. */
export const DAY_REFRESH_MS = 30_000;

/**
 * One day's bookings at one of the owner's restaurants, asked for again every 30 seconds while the
 * page is open. Unlike Browse, moving to another day doesn't keep the last day on screen while the
 * next loads: under a new date, another day's bookings could be mistaken for that day's.
 */
export function useDayReservations(
  id: string,
  date: string,
  page: number,
): UseQueryResult<ListResponse<OwnerReservation>, ApiError> {
  return useQuery<ListResponse<OwnerReservation>, ApiError>({
    queryKey: ownerKeys.day(id, date, page),
    queryFn: () => {
      const query = new URLSearchParams({ date, page: String(page) });
      return apiGet<ListResponse<OwnerReservation>>(
        `${ownerRestaurantPath(id)}/reservations?${query.toString()}`,
      );
    },
    refetchInterval: DAY_REFRESH_MS,
  });
}

/** A change to one booking, and the booking it's for. */
export interface BookingChangeRequest extends BookingChange {
  reservation: OwnerReservation;
}

/**
 * Confirms a booking, cancels it, or marks the guest arrived or a no-show. The server refuses a
 * change the booking no longer allows, such as confirming one the guest has just cancelled.
 */
export function useChangeBooking(
  id: string,
): UseMutationResult<OwnerReservation, ApiError, BookingChangeRequest> {
  const queryClient = useQueryClient();
  return useMutation<OwnerReservation, ApiError, BookingChangeRequest>({
    mutationFn: async ({ reservation, ...change }) =>
      (
        await apiPatch<OwnerReservationResponse>(
          `${ownerRestaurantPath(id)}/reservations/${encodeURIComponent(reservation.id)}`,
          change,
        )
      ).reservation,
    // Changed or refused, the day shows its bookings as they are now.
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ownerKeys.bookings(id) }),
  });
}
