import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import type { ApiError } from "@/lib/api";
import type { Availability } from "@/types/api";

/** A restaurant's times on a date, each with the tables free for the party. */
export function useAvailability(
  slug: string,
  date: string,
  guests: number,
): UseQueryResult<Availability, ApiError> {
  return useQuery<Availability, ApiError>({
    queryKey: ["availability", slug, date, guests],
    queryFn: () =>
      apiGet<Availability>(
        `/api/restaurants/${encodeURIComponent(slug)}/availability?date=${date}&partySize=${guests}`,
      ),
  });
}
