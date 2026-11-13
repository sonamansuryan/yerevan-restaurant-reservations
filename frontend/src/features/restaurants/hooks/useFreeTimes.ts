import { useAvailability } from "@/features/booking/hooks/useAvailability";
import type { FreeTimesState } from "@/features/restaurants/components/FreeTimes";
import { nearestFreeTimes } from "@/features/restaurants/tableSearch";
import type { TableQuery } from "@/features/restaurants/tableSearch";

/**
 * One restaurant's free times nearest the table looked for, for its card on Browse. It's the same
 * request the restaurant's page makes for that day and party, so opening the page afterwards shows
 * its times at once.
 */
export function useFreeTimes(slug: string, query: TableQuery): FreeTimesState {
  const availability = useAvailability(slug, query.date, query.guests);
  if (availability.data) {
    return { status: "ready", times: nearestFreeTimes(availability.data, query.time) };
  }
  if (availability.isError) return { status: "failed" };
  return { status: "loading" };
}
