import { useQuery } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { useCallback } from "react";
import { useSearchParams } from "react-router";

import { daysToParams, readDays } from "@/features/analytics/analytics";
import type { AnalyticsPart } from "@/features/analytics/components/AnalyticsReport";
import { apiGet } from "@/lib/api";
import type { ApiError } from "@/lib/api";
import type { Analytics, AnalyticsDays } from "@/types/api";

interface AnalyticsSource {
  /** The numbers' place in the cache, for a period. It must start with a private prefix. */
  key: (days: AnalyticsDays) => QueryKey;
  /** Where the API counts them, for a period. */
  path: (days: AnalyticsDays) => string;
  /**
   * Whether numbers already on screen may stay there, faded, while the next ones load: true for
   * another period of the same place, but never for another restaurant's.
   */
  sameAs: (key: QueryKey, earlier: QueryKey) => boolean;
}

/**
 * One set of numbers, for the period in the address. Each period is cached on its own, so Back
 * shows the last one at once, and while a new period loads, the last one stays on screen, faded.
 */
export function useAnalytics<T extends Analytics>({
  key,
  path,
  sameAs,
}: AnalyticsSource): AnalyticsPart<T> {
  const [params, setParams] = useSearchParams();
  const days = readDays(params);
  const queryKey = key(days);

  const query = useQuery<T, ApiError>({
    queryKey,
    queryFn: async () => (await apiGet<{ analytics: T }>(path(days))).analytics,
    placeholderData: (previous, previousQuery) =>
      previousQuery && sameAs(queryKey, previousQuery.queryKey) ? previous : undefined,
    // One quick retry, then the error shows, instead of about 7 seconds of retrying.
    retry: 1,
  });

  const onDaysChange = useCallback(
    // The page keeps its scroll position instead of jumping to the top.
    (next: AnalyticsDays) => setParams(daysToParams(next), { preventScrollReset: true }),
    [setParams],
  );

  return {
    days,
    onDaysChange,
    report: {
      data: query.data,
      failed: query.isError,
      // A retry clears the error while it runs. Staying on the error keeps Try again in its place.
      retrying: query.isFetching && query.errorUpdateCount > 0,
      onRetry: () => void query.refetch(),
      updating: query.isPlaceholderData,
    },
  };
}
