// What OpenStreetMap and Wikimedia Commons say about each place in sources.ts, with the details
// checked by hand there, as listings for a person to review (PROJECT_PLAN.md 9.7). It only reads.
// The sources are passed in, so tests can stand in for them.
import type { CommonsPhoto } from "../../src/integrations/wikimedia/commons.ts";
import type { OsmPlace } from "../../src/integrations/geoapify/places.ts";
import { MAX_LISTINGS, listingFrom, listingKey, sourceKey } from "./rules.ts";
import type { Listing, ListingSource } from "./rules.ts";

export interface Lookups {
  place: (osmRef: string) => Promise<OsmPlace | null>;
  photos: (titles: string[]) => Promise<CommonsPhoto[]>;
}

export interface Collected {
  listings: Listing[];
  /** Every source that can't be a listing, by its OpenStreetMap id or slug, with all its reasons. */
  refused: { source: string; problems: string[] }[];
}

/** Every source as a listing, or the reasons it can't be one. A source is never half listed. */
export async function collectListings(
  sources: readonly ListingSource[],
  lookups: Lookups,
): Promise<Collected> {
  const refused: Collected["refused"] = [];
  const keys = sources.map(sourceKey);
  if (sources.length > MAX_LISTINGS) {
    refused.push({ source: "all", problems: [`more than ${MAX_LISTINGS} places`] });
    return { listings: [], refused };
  }
  for (const key of keys.filter((one, index) => keys.indexOf(one) !== index)) {
    refused.push({ source: key, problems: ["named twice"] });
  }

  // Every Commons photo in one go: Commons answers up to 50 files a request. A restaurant's own
  // photos need no lookup.
  const titles = sources.flatMap(({ photos }) =>
    photos.filter((photo): photo is string => typeof photo === "string"),
  );
  const photos = await lookups.photos(titles);
  const listings: Listing[] = [];
  for (const source of sources) {
    const place = source.osm ? await lookups.place(source.osm) : null;
    const result = listingFrom(source, place, photos);
    if ("problems" in result)
      refused.push({ source: sourceKey(source), problems: result.problems });
    else listings.push(result.listing);
  }

  // Each page needs its own address. A clash needs a `slug` in sources.ts.
  const slugs = listings.map(({ slug }) => slug);
  for (const listing of listings.filter(({ slug }, index) => slugs.indexOf(slug) !== index)) {
    refused.push({
      source: listingKey(listing),
      problems: [`its address, ${listing.slug}, is taken`],
    });
  }
  const refusedKeys = new Set(refused.map(({ source }) => source));
  return { listings: listings.filter((listing) => !refusedKeys.has(listingKey(listing))), refused };
}
