import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import { ownerKeys, ownerRestaurantPath } from "@/features/dashboard/queryKeys";
import { apiGet } from "@/lib/api";
import type { ApiError } from "@/lib/api";
import type { ListResponse, OwnerReservation } from "@/types/api";

/**
 * One day's bookings at one of the owner's restaurants. Unlike Browse, moving to another day
 * doesn't keep the last day on screen while the next loads: under a new date, another day's
 * bookings could be mistaken for that day's.
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
  });
}
