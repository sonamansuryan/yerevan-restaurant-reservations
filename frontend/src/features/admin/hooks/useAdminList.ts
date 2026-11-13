import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import type { To } from "react-router";

import { adminKeys, adminListPath, filtersToParams } from "@/features/admin/admin";
import type { AdminPart } from "@/features/admin/admin";
import type { AdminListState } from "@/features/admin/components/AdminListBody";
import { apiGet } from "@/lib/api";
import type { ApiError } from "@/lib/api";
import type { ListResponse } from "@/types/api";

export interface AdminListPart<T, F extends { page: number }> {
  filters: F;
  /** New filters, in the address. Each change is a new history entry, so Back undoes it. */
  onFiltersChange: (filters: F) => void;
  list: AdminListState<T>;
  hrefFor: (page: number) => To;
}

/**
 * One of the admin's lists: its filters, read from the address with `read`, and the page of rows
 * they ask for. Each set of filters is cached on its own, so Back shows the earlier page at once,
 * and while a new page loads, the last one stays on screen. `read` must be a function defined
 * once, outside any component, so the filters only change when the address does.
 */
export function useAdminList<T, F extends { page: number }>(
  part: AdminPart,
  read: (params: URLSearchParams) => F,
): AdminListPart<T, F> {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => read(params), [read, params]);

  const query = useQuery<ListResponse<T>, ApiError>({
    queryKey: adminKeys.list(part, filters),
    queryFn: () => apiGet<ListResponse<T>>(adminListPath(part, filters)),
    placeholderData: keepPreviousData,
    // One quick retry, then the error shows, instead of about 7 seconds of retrying.
    retry: 1,
  });

  const onFiltersChange = useCallback(
    // The page keeps its scroll position instead of jumping to the top.
    (next: F) => setParams(filtersToParams(next), { preventScrollReset: true }),
    [setParams],
  );
  const hrefFor = useCallback(
    (page: number): To => ({ search: filtersToParams({ ...filters, page }).toString() }),
    [filters],
  );

  return {
    filters,
    onFiltersChange,
    list: {
      data: query.data,
      failed: query.isError,
      // A retry clears the error while it runs. Staying on the error keeps Try again in its place.
      retrying: query.isFetching && query.errorUpdateCount > 0,
      onRetry: () => void query.refetch(),
      updating: query.isPlaceholderData,
    },
    hrefFor,
  };
}
