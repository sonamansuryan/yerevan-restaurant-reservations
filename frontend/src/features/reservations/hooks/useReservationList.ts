import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import type { ReservationsWhen } from "@/features/reservations/reservations";
import { apiGet } from "@/lib/api";
import type { ApiError } from "@/lib/api";
import type { GuestReservation, ListResponse } from "@/types/api";

/** One page of the signed-in guest's bookings: upcoming ones soonest first, or past ones latest first. */
export function useReservationList(
  when: ReservationsWhen,
  page: number,
): UseQueryResult<ListResponse<GuestReservation>, ApiError> {
  return useQuery<ListResponse<GuestReservation>, ApiError>({
    queryKey: ["reservations", when, page],
    queryFn: () =>
      apiGet<ListResponse<GuestReservation>>(`/api/reservations?when=${when}&page=${page}`),
  });
}
