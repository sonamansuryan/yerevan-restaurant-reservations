import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";

import type { BlockRequest } from "@/features/dashboard/blocks";
import { ownerKeys, ownerRestaurantPath } from "@/features/dashboard/queryKeys";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import type { ApiError } from "@/lib/api";
import type { ListResponse, OwnerBlock, OwnerBlockResponse } from "@/types/api";

/** One restaurant's blocks that aren't over yet, by when they start. */
export function useBlocks(id: string): UseQueryResult<ListResponse<OwnerBlock>, ApiError> {
  return useQuery<ListResponse<OwnerBlock>, ApiError>({
    queryKey: ownerKeys.blocks(id),
    queryFn: () => apiGet<ListResponse<OwnerBlock>>(`${ownerRestaurantPath(id)}/blocks`),
  });
}

/** Blocks a table or the whole restaurant. Bookings inside the block refuse it (409, listed). */
export function useAddBlock(id: string): UseMutationResult<OwnerBlock, ApiError, BlockRequest> {
  const queryClient = useQueryClient();
  return useMutation<OwnerBlock, ApiError, BlockRequest>({
    mutationFn: async (request) =>
      (await apiPost<OwnerBlockResponse>(`${ownerRestaurantPath(id)}/blocks`, request)).block,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ownerKeys.blocks(id) }),
  });
}

/** Removes a block, so its time can be booked again. */
export function useRemoveBlock(id: string): UseMutationResult<void, ApiError, string> {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (blockId) =>
      apiDelete<void>(`${ownerRestaurantPath(id)}/blocks/${encodeURIComponent(blockId)}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ownerKeys.blocks(id) }),
  });
}
