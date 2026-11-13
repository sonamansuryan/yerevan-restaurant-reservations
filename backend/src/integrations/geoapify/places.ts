// One place's details from OpenStreetMap, as Geoapify serves them (PROJECT_PLAN.md 9.7). Only the
// demo listings' collector asks, by OpenStreetMap id, never the app itself. Geoapify allows storing
// what it answers, and the data is OpenStreetMap's, credited "© OpenStreetMap contributors".
import { GEOAPIFY_TIMEOUT_MS, geoapifyUrl } from "./maps.ts";

/** What a listing needs to know about a place, as OpenStreetMap has it. */
export interface OsmPlace {
  /** Its OpenStreetMap id, such as "node/6566646015". */
  osmRef: string;
  /** Its English name, and its name as written there, often in Armenian. */
  nameEn: string | null;
  name: string | null;
  /**
   * Its street and house number, as Geoapify gives them: never a nearby street guessed for it, which
   * comes without a house number.
   */
  street: string | null;
  housenumber: string | null;
  /**
   * Whether that house number is the place's own, from its OpenStreetMap address tags. When it
   * isn't, Geoapify took it from a building nearby, which can be the wrong one.
   */
  ownAddress: boolean;
  /** The district it's in, such as "Kentron". */
  district: string | null;
  /** OpenStreetMap's own words, such as "armenian;georgian" and "Mo-Su 11:00-00:00". */
  cuisine: string | null;
  openingHours: string | null;
  phone: string | null;
  website: string | null;
  /** The day someone last confirmed it on the spot, if they said. */
  checkDate: string | null;
}

/** Geoapify couldn't be reached, or refused, such as for a wrong key or a used-up daily quota. */
export class PlacesUnavailableError extends Error {
  /** What went wrong, such as "PLACE_401". Never the request's address, which holds the key. */
  readonly code: string;

  constructor(code: string) {
    super(`Geoapify didn't answer as expected: ${code}`);
    this.name = "PlacesUnavailableError";
    this.code = code;
  }
}

const OSM_TYPES = { node: "n", way: "w", relation: "r" } as const;

// Geoapify passes some values on as numbers, such as a house number of 10, so those count as text.
const text = (value: unknown): string | null => {
  const written = typeof value === "number" ? String(value) : value;
  return typeof written === "string" && written.trim() ? written.trim() : null;
};

/** A name written in Latin letters, such as "Mayrig", already reads as its English one. */
const latin = (name: string | null): string | null =>
  name !== null && /^[\p{Script=Latin}\p{N}\p{P}\p{Zs}]+$/u.test(name) ? name : null;

/** The details Geoapify gives for a place, picked out of its answer. */
export function placeFromDetails(osmRef: string, properties: Record<string, unknown>): OsmPlace {
  const raw = ((properties["datasource"] as { raw?: unknown } | undefined)?.raw ?? {}) as Record<
    string,
    unknown
  >;
  const names = (properties["name_international"] ?? {}) as Record<string, unknown>;
  const contact = (properties["contact"] ?? {}) as Record<string, unknown>;
  // A house number means a real address: the place's own, or the building's it's in. Without one,
  // Geoapify's street is only the nearest street, which can be the wrong one.
  const housenumber = text(properties["housenumber"]) ?? text(raw["addr:housenumber"]);
  return {
    osmRef,
    nameEn: text(names["en"]) ?? text(raw["name:en"]) ?? latin(text(properties["name"])),
    name: text(properties["name"]),
    street: housenumber ? text(properties["street"]) : null,
    housenumber,
    ownAddress: text(raw["addr:housenumber"]) !== null,
    district: text(properties["suburb"]) ?? text(properties["district"]),
    cuisine: text(raw["cuisine"]),
    openingHours: text(raw["opening_hours"]),
    phone: text(contact["phone"]) ?? text(raw["phone"]) ?? text(raw["contact:phone"]),
    website: text(properties["website"]) ?? text(raw["website"]) ?? text(raw["contact:website"]),
    checkDate: text(raw["check_date"]),
  };
}

/** A place by its OpenStreetMap id, such as "node/6566646015", or null when there's no such place. */
export async function osmPlace(osmRef: string): Promise<OsmPlace | null> {
  const [type, id] = osmRef.split("/");
  const osmType = OSM_TYPES[type as keyof typeof OSM_TYPES];
  if (!osmType || !id || !/^\d+$/.test(id)) throw new Error(`Not an OpenStreetMap id: ${osmRef}`);

  const url = geoapifyUrl("https://api.geoapify.com/v2/place-details", {
    osm_id: id,
    osm_type: osmType,
    features: "details",
    // English names where OpenStreetMap has them, such as "Pushkin Street".
    lang: "en",
  });
  const response = await fetch(url, { signal: AbortSignal.timeout(GEOAPIFY_TIMEOUT_MS) });
  if (!response.ok) throw new PlacesUnavailableError(`PLACE_${response.status}`);
  const body = (await response.json()) as { features?: { properties?: unknown }[] };
  const properties = body.features?.[0]?.properties;
  return properties && typeof properties === "object"
    ? placeFromDetails(osmRef, properties as Record<string, unknown>)
    : null;
}
