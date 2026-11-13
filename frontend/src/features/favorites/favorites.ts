// A guest's favorites in the shared cache. Every key starts with "favorites", so they're forgotten
// at once when the person signed in changes (forgetPrivateData in lib/queryClient.ts).
export const favoriteKeys = {
  /** Every page of My favorites. */
  lists: ["favorites", "list"] as const,
  list: (page: number) => ["favorites", "list", page] as const,
  /** Whether one restaurant is saved, for its page. */
  restaurant: (slug: string) => ["favorites", "restaurant", slug] as const,
};

/** The address of a page of My favorites. */
export function favoritesPath(page = 1): string {
  return page > 1 ? `/favorites?page=${page}` : "/favorites";
}

/** The API address of one favorite: the restaurant's own address on Seghan. */
export function favoriteUrl(slug: string): string {
  return `/api/favorites/${encodeURIComponent(slug)}`;
}
