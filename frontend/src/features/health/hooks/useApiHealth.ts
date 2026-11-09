import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import type { HealthResponse } from "@/types/api";

export function useApiHealth(): UseQueryResult<HealthResponse> {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => apiGet<HealthResponse>("/api/health"),
    // Show a problem straight away. By default TanStack Query retries for about 7 seconds first.
    retry: false,
  });
}
