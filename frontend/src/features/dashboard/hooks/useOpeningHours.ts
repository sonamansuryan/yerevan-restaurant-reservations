import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";

import type { Opening } from "@/features/dashboard/hours";
import { ownerKeys, ownerRestaurantPath } from "@/features/dashboard/queryKeys";
import { apiGet, apiPut } from "@/lib/api";
import type { ApiError } from "@/lib/api";
import type { OpeningHours, OpeningHoursResponse } from "@/types/api";

/** A restaurant's week, as saved. */
export function useOpeningHours(id: string): UseQueryResult<OpeningHours[], ApiError> {
  return useQuery<OpeningHours[], ApiError>({
    queryKey: ownerKeys.openingHours(id),
    queryFn: async () =>
      (await apiGet<OpeningHoursResponse>(`${ownerRestaurantPath(id)}/opening-hours`)).openingHours,
  });
}

/**
 * Saves the whole week at once. The answer is the week as saved, so it's shown straight away, and
 * the restaurant's own page is fetched again the next time someone opens it.
 */
export function useSaveOpeningHours(
  id: string,
): UseMutationResult<OpeningHours[], ApiError, Opening[]> {
  const queryClient = useQueryClient();
  return useMutation<OpeningHours[], ApiError, Opening[]>({
    mutationFn: async (hours) =>
      (await apiPut<OpeningHoursResponse>(`${ownerRestaurantPath(id)}/opening-hours`, { hours }))
        .openingHours,
    onSuccess: (week) => {
      queryClient.setQueryData(ownerKeys.openingHours(id), week);
      void queryClient.invalidateQueries({ queryKey: ["restaurant"] });
    },
  });
}
