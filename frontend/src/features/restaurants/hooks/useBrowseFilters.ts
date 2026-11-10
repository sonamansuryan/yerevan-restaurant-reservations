import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import type { To } from "react-router";

import { filtersToParams, readFilters } from "@/features/restaurants/browseFilters";
import type { BrowseFilters } from "@/features/restaurants/browseFilters";

interface BrowseFiltersState {
  filters: BrowseFilters;
  setFilters: (filters: BrowseFilters) => void;
  /** The address of another page with the same filters. */
  hrefFor: (page: number) => To;
}

/**
 * Browse's filters, kept in the address. Each change is a new history entry, so Back undoes it,
 * and the page keeps its scroll position instead of jumping to the top.
 */
export function useBrowseFilters(): BrowseFiltersState {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => readFilters(params), [params]);

  const setFilters = useCallback(
    (next: BrowseFilters) => setParams(filtersToParams(next), { preventScrollReset: true }),
    [setParams],
  );

  const hrefFor = useCallback(
    (page: number): To => ({ search: filtersToParams({ ...filters, page }).toString() }),
    [filters],
  );

  return { filters, setFilters, hrefFor };
}
