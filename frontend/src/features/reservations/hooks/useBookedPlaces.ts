import { useQueries } from "@tanstack/react-query";

import type { BookedPlace } from "@/features/reservations/components/GuestBookings";
import { apiGet } from "@/lib/api";
import type { RestaurantDetail, RestaurantResponse } from "@/types/api";

/**
 * The photo and map link of each restaurant the guest has booked, for their cards. A booking names
 * only its restaurant, so each restaurant's page is asked for once, under the same key the
 * restaurant's own page uses, so opening it afterwards is instant. A restaurant that can't be shown
 * any more gets its tone and no directions.
 */
export function useBookedPlaces(slugs: string[]): (slug: string) => BookedPlace | undefined {
  const unique = [...new Set(slugs)];
  const results = useQueries({
    queries: unique.map((slug) => ({
      queryKey: ["restaurant", slug],
      queryFn: async (): Promise<RestaurantDetail> =>
        (await apiGet<RestaurantResponse>(`/api/restaurants/${encodeURIComponent(slug)}`))
          .restaurant,
      retry: 1,
    })),
  });
  const places = new Map<string, BookedPlace | undefined>(
    unique.map((slug, index) => {
      const result = results[index];
      if (result?.data) {
        return [slug, { cover: result.data.coverPhotoUrl, mapsUrl: result.data.mapsUrl }];
      }
      return [slug, result?.isError ? { cover: null, mapsUrl: "" } : undefined];
    }),
  );
  return (slug) => places.get(slug);
}
