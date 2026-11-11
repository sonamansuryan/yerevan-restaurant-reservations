import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient, UseMutationResult, UseQueryResult } from "@tanstack/react-query";

import { ownerKeys, ownerRestaurantPath } from "@/features/dashboard/queryKeys";
import type { TableRequest } from "@/features/dashboard/tables";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import type { ApiError } from "@/lib/api";
import type { ListResponse, OwnerTable, OwnerTableResponse } from "@/types/api";

/** One restaurant's tables, active and inactive, in the order they were added. */
export function useTables(id: string): UseQueryResult<ListResponse<OwnerTable>, ApiError> {
  return useQuery<ListResponse<OwnerTable>, ApiError>({
    queryKey: ownerKeys.tables(id),
    queryFn: () => apiGet<ListResponse<OwnerTable>>(`${ownerRestaurantPath(id)}/tables`),
  });
}

/**
 * After a change, the tables are fetched again. So are the bookings, which show each booking's
 * table by name.
 */
function refresh(queryClient: QueryClient, id: string): void {
  void queryClient.invalidateQueries({ queryKey: ownerKeys.tables(id) });
  void queryClient.invalidateQueries({ queryKey: ownerKeys.bookings(id) });
}

/** Adds a table. It can be booked straight away. */
export function useAddTable(id: string): UseMutationResult<OwnerTable, ApiError, TableRequest> {
  const queryClient = useQueryClient();
  return useMutation<OwnerTable, ApiError, TableRequest>({
    mutationFn: async (request) =>
      (await apiPost<OwnerTableResponse>(`${ownerRestaurantPath(id)}/tables`, request)).table,
    onSuccess: () => refresh(queryClient, id),
  });
}

/** A change to one table: its details, or whether it can be booked. */
export interface TableChange {
  tableId: string;
  change: Partial<TableRequest> & { isActive?: boolean };
}

/** Changes one table. Switching it off is refused while bookings need it (409, listed). */
export function useUpdateTable(id: string): UseMutationResult<OwnerTable, ApiError, TableChange> {
  const queryClient = useQueryClient();
  return useMutation<OwnerTable, ApiError, TableChange>({
    mutationFn: async ({ tableId, change }) =>
      (
        await apiPatch<OwnerTableResponse>(
          `${ownerRestaurantPath(id)}/tables/${encodeURIComponent(tableId)}`,
          change,
        )
      ).table,
    onSuccess: () => refresh(queryClient, id),
  });
}
