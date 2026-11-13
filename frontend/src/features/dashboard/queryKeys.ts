// The owner's data in the shared cache. Every key starts with "owner", so when the person signed
// in changes, all of it is dropped at once (forgetPrivateData in lib/queryClient.ts). A guest's
// cached pages ("restaurants", "restaurant") never mix with it.
export const ownerKeys = {
  restaurants: ["owner", "restaurants"] as const,
  restaurant: (id: string) => ["owner", "restaurant", id] as const,
  openingHours: (id: string) => ["owner", "opening-hours", id] as const,
  photos: (id: string) => ["owner", "photos", id] as const,
  day: (id: string, date: string, page: number) =>
    ["owner", "reservations", id, date, page] as const,
  /** Every day of one restaurant's bookings, to fetch them all again at once. */
  bookings: (id: string) => ["owner", "reservations", id] as const,
  tables: (id: string) => ["owner", "tables", id] as const,
  blocks: (id: string) => ["owner", "blocks", id] as const,
  analytics: (id: string, days: number) => ["owner", "analytics", id, days] as const,
};

/** Where one of the owner's restaurants lives in the API. Ids are encoded, like any address part. */
export function ownerRestaurantPath(id: string): string {
  return `/api/owner/restaurants/${encodeURIComponent(id)}`;
}
