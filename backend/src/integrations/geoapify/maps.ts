// Street maps from OpenStreetMap data, drawn by Geoapify (PROJECT_PLAN.md 9.4). Its free plan needs
// no card, allows production use, and has soft daily limits, so nothing is ever charged. This is
// the only code that talks to Geoapify, so tests replace it. The key never leaves the server:
// browsers get the picture from our own API. Never log a request's address: it holds the key.
import { env } from "../../config/env.ts";

/** How long Geoapify gets to answer before the map counts as unavailable. */
export const GEOAPIFY_TIMEOUT_MS = 8_000;

/** A place on the map, in degrees. */
export interface MapPoint {
  lat: number;
  lon: number;
}

/** Geoapify couldn't be reached, or refused, such as for a wrong key or a used-up daily quota. */
export class MapUnavailableError extends Error {
  /** What went wrong, such as "GEOCODE_401". Never the request's address, which holds the key. */
  readonly code: string;

  constructor(code: string) {
    super(`Geoapify didn't answer as expected: ${code}`);
    this.name = "MapUnavailableError";
    this.code = code;
  }
}

/** Whether maps are set up: GEOAPIFY_API_KEY is in backend/.env. Without it, no map is shown. */
export function mapsEnabled(): boolean {
  return env.GEOAPIFY_API_KEY !== undefined;
}

/** A Geoapify address with its query and our key. Never log it: it holds the key. */
export function geoapifyUrl(base: string, params: Record<string, string>): URL {
  const url = new URL(base);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  url.searchParams.set("apiKey", env.GEOAPIFY_API_KEY ?? "");
  return url;
}

/** Finds an address in Armenia, or null when Geoapify doesn't know it. */
export async function findAddress(address: string): Promise<MapPoint | null> {
  const url = geoapifyUrl("https://api.geoapify.com/v1/geocode/search", {
    text: address,
    filter: "countrycode:am",
    limit: "1",
    format: "json",
  });
  const response = await fetch(url, { signal: AbortSignal.timeout(GEOAPIFY_TIMEOUT_MS) });
  if (!response.ok) throw new MapUnavailableError(`GEOCODE_${response.status}`);
  const body = (await response.json()) as { results?: { lat?: unknown; lon?: unknown }[] };
  const first = body.results?.[0];
  return typeof first?.lat === "number" && typeof first.lon === "number"
    ? { lat: first.lat, lon: first.lon }
    : null;
}

/**
 * The street around a point, as a PNG: 640 by 400 at twice the pixels for sharp screens, close
 * enough to read the street names, in Positron, a light and quiet style. Geoapify prints the
 * attribution its free plan and OpenStreetMap require in the bottom-right corner, so it's kept.
 */
export async function streetMap({ lat, lon }: MapPoint): Promise<Uint8Array> {
  const url = geoapifyUrl("https://maps.geoapify.com/v1/staticmap", {
    style: "positron",
    width: "640",
    height: "400",
    scaleFactor: "2",
    format: "png",
    center: `lonlat:${lon},${lat}`,
    zoom: "16",
  });
  const response = await fetch(url, { signal: AbortSignal.timeout(GEOAPIFY_TIMEOUT_MS) });
  if (!response.ok) throw new MapUnavailableError(`STATIC_MAP_${response.status}`);
  if (!response.headers.get("content-type")?.startsWith("image/")) {
    throw new MapUnavailableError("STATIC_MAP_NOT_AN_IMAGE");
  }
  return new Uint8Array(await response.arrayBuffer());
}
