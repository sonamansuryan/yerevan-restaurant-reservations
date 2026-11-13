import { CUISINE_LABELS, DISTRICT_LABELS } from "@/features/restaurants/labels";
import type { Cuisine, District, RestaurantSort } from "@/types/api";

/** What Browse is showing. The address holds it, so Back, Forward and shared links all work. */
export interface BrowseFilters {
  q?: string;
  cuisine?: Cuisine;
  district?: District;
  price?: number;
  /** By name when it's missing, as the API sorts. */
  sort?: RestaurantSort;
  page: number;
}

export const isCuisine = (value: string | null): value is Cuisine =>
  value !== null && Object.hasOwn(CUISINE_LABELS, value);

export const isDistrict = (value: string | null): value is District =>
  value !== null && Object.hasOwn(DISTRICT_LABELS, value);

/** A whole number from the address, or undefined when it's anything else. */
function wholeNumber(value: string | null, min: number, max: number): number | undefined {
  if (value === null || !/^\d+$/.test(value)) return undefined;
  const number = Number(value);
  return number >= min && number <= max ? number : undefined;
}

/**
 * Reads the filters from the address by the server's rules. A value the server would refuse, such
 * as ?cuisine=PIZZA in a hand-edited link, is ignored, so the page shows everything instead of an
 * error.
 */
export function readFilters(params: URLSearchParams): BrowseFilters {
  const q = params.get("q")?.trim().slice(0, 100);
  const cuisine = params.get("cuisine");
  const district = params.get("district");
  const price = wholeNumber(params.get("price"), 1, 4);
  return {
    ...(q ? { q } : {}),
    ...(isCuisine(cuisine) ? { cuisine } : {}),
    ...(isDistrict(district) ? { district } : {}),
    ...(price ? { price } : {}),
    // Name is the default, so only rating is ever in the address.
    ...(params.get("sort") === "rating" ? { sort: "rating" as const } : {}),
    page: wholeNumber(params.get("page"), 1, 1000) ?? 1,
  };
}

/** The filters as an address query, leaving out what's empty and page 1. */
export function filtersToParams(filters: BrowseFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.cuisine) params.set("cuisine", filters.cuisine);
  if (filters.district) params.set("district", filters.district);
  if (filters.price) params.set("price", String(filters.price));
  if (filters.sort === "rating") params.set("sort", "rating");
  if (filters.page > 1) params.set("page", String(filters.page));
  return params;
}

/**
 * True when anything narrows the list, so "Clear filters" has something to clear. The order isn't a
 * filter, so it stays when they're cleared.
 */
export function isFiltered({ q, cuisine, district, price }: BrowseFilters): boolean {
  return Boolean(q || cuisine || district || price);
}
