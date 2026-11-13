// Rules for the restaurants guests see that need no database. They're plain functions, so they're
// tested on their own.

/**
 * The restaurants the home page features, in this order, chosen by hand (9.7). One that isn't
 * published, or that Seghan's admin has hidden, is simply left out.
 */
export const FEATURED_SLUGS: readonly string[] = ["gustav", "paul", "dolmama"];

/** How many restaurants the home page shows: one row on a laptop. */
export const FEATURED_COUNT = 3;

/**
 * The home page's restaurants: the chosen ones that can be shown, in the chosen order, then the
 * first others by name, so the row is always full while there are enough restaurants to fill it.
 */
export function featuredOrder<Restaurant extends { slug: string }>(
  chosen: readonly Restaurant[],
  byName: readonly Restaurant[],
): Restaurant[] {
  const inOrder = FEATURED_SLUGS.flatMap((slug) => chosen.filter((one) => one.slug === slug));
  const others = byName.filter((one) => !inOrder.some(({ slug }) => slug === one.slug));
  return [...inOrder, ...others].slice(0, FEATURED_COUNT);
}
