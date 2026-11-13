import { isCalendarDate } from "@/lib/time";
import type { AdminRestaurant, ReservationStatus, UserRole } from "@/types/api";

// Seghan's admin area (9.5): its three lists, and what each is filtered by. The filters live in
// the address, as Browse's do, so Back, Forward and shared links all work. They have the API's own
// names, so the address's query is also the request's.

/** The admin's lists, each a part of the admin area and a route of GET /api/admin. */
export type AdminPart = "restaurants" | "reservations" | "users";

/** What guests can see of a restaurant, as the restaurants list's Show filter takes it. */
export type RestaurantShow = "published" | "draft" | "hidden";

export interface AdminRestaurantFilters {
  /** Part of a name or an address. */
  q?: string;
  show?: RestaurantShow;
  page: number;
}

export interface AdminReservationFilters {
  /** Part of a restaurant's name, or of a guest's name or email. */
  q?: string;
  status?: ReservationStatus;
  /** A day in Yerevan, as YYYY-MM-DD. */
  date?: string;
  page: number;
}

export interface AdminUserFilters {
  /** Part of a name or an email. */
  q?: string;
  role?: UserRole;
  page: number;
}

export const RESTAURANT_SHOWS: readonly RestaurantShow[] = ["published", "draft", "hidden"];
export const RESERVATION_STATUSES: readonly ReservationStatus[] = [
  "PENDING",
  "CONFIRMED",
  "ARRIVED",
  "NO_SHOW",
  "CANCELLED",
];
export const USER_ROLES: readonly UserRole[] = ["CUSTOMER", "OWNER", "ADMIN"];

/** The choice that matches the text, or undefined, as a choice left empty means "any". */
export function oneOf<T extends string>(choices: readonly T[], text: string | null): T | undefined {
  return choices.find((choice) => choice === text);
}

/** The search as the API takes it: trimmed, at most 100 characters, and left out when empty. */
function searchFrom(params: URLSearchParams): string | undefined {
  return params.get("q")?.trim().slice(0, 100) || undefined;
}

/** The page asked for, from 1 to 1000 as the API allows. Anything else means the first. */
function pageFrom(params: URLSearchParams): number {
  const text = params.get("page") ?? "";
  const page = Number(text);
  return /^\d+$/.test(text) && page >= 1 && page <= 1000 ? page : 1;
}

// Each reads the filters from the address by the server's rules. A value the server would refuse,
// such as ?role=CHEF in a hand-edited link, is left out, so the list shows everything instead.

export function readRestaurantFilters(params: URLSearchParams): AdminRestaurantFilters {
  const q = searchFrom(params);
  const show = oneOf(RESTAURANT_SHOWS, params.get("show"));
  return { ...(q ? { q } : {}), ...(show ? { show } : {}), page: pageFrom(params) };
}

export function readReservationFilters(params: URLSearchParams): AdminReservationFilters {
  const q = searchFrom(params);
  const status = oneOf(RESERVATION_STATUSES, params.get("status"));
  const date = params.get("date") ?? "";
  return {
    ...(q ? { q } : {}),
    ...(status ? { status } : {}),
    ...(isCalendarDate(date) ? { date } : {}),
    page: pageFrom(params),
  };
}

export function readUserFilters(params: URLSearchParams): AdminUserFilters {
  const q = searchFrom(params);
  const role = oneOf(USER_ROLES, params.get("role"));
  return { ...(q ? { q } : {}), ...(role ? { role } : {}), page: pageFrom(params) };
}

/** Any list's filters as a query, leaving out what's empty and page 1. */
export function filtersToParams<F extends { page: number }>(filters: F): URLSearchParams {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(filters) as [string, unknown][]) {
    if (value === undefined || value === "" || (name === "page" && value === 1)) continue;
    params.set(name, String(value));
  }
  return params;
}

/** True when anything narrows the list, so "Clear filters" has something to clear. */
export function isFiltered<F extends { page: number }>({ page: _page, ...choices }: F): boolean {
  return Object.values(choices).some((value) => value !== undefined);
}

/** Where a list lives in the API, with its filters. */
export function adminListPath<F extends { page: number }>(part: AdminPart, filters: F): string {
  const query = filtersToParams(filters).toString();
  return `/api/admin/${part}${query ? `?${query}` : ""}`;
}

/** Where one restaurant's visibility is changed. Ids are encoded, like any address part. */
export function adminRestaurantPath(id: string): string {
  return `/api/admin/restaurants/${encodeURIComponent(id)}`;
}

// The admin's data in the shared cache. Every key starts with "admin", so when the person signed in
// changes, all of it is dropped at once (forgetPrivateData in lib/queryClient.ts).
export const adminKeys = {
  all: ["admin"] as const,
  /** Every page of one list, to fetch them all again at once. */
  part: (part: AdminPart) => ["admin", part] as const,
  list: (part: AdminPart, filters: { page: number }) => ["admin", part, filters] as const,
  /** All of Seghan's numbers for a period (9.6). */
  analytics: (days: number) => ["admin", "analytics", days] as const,
};

/** Who someone is, in a word. */
export const ROLE_LABELS: Record<UserRole, string> = {
  CUSTOMER: "Guest",
  OWNER: "Owner",
  ADMIN: "Admin",
};

/** The role filter's choices: everyone with that role. */
export const ROLE_CHOICES: Record<UserRole, string> = {
  CUSTOMER: "Guests",
  OWNER: "Owners",
  ADMIN: "Admins",
};

/** The restaurants list's Show filter: what guests see of them. */
export const SHOW_CHOICES: Record<RestaurantShow, string> = {
  published: "Published",
  draft: "Drafts",
  hidden: "Hidden by Seghan",
};

/** "1 restaurant", "3 restaurants". */
export function restaurantsWords(count: number): string {
  return count === 1 ? "1 restaurant" : `${count} restaurants`;
}

/** "1 user", "12 users". */
export function usersWords(count: number): string {
  return count === 1 ? "1 user" : `${count} users`;
}

/** What a change did, in words: the line it changed may have left the list by now. */
export function visibilityWords(restaurant: AdminRestaurant): string {
  if (restaurant.hiddenAt !== null) {
    return `${restaurant.name} is hidden. Guests can’t find or book it until you show it again.`;
  }
  return restaurant.isPublished
    ? `${restaurant.name} is shown again. Guests can find it and book a table.`
    : `${restaurant.name} is no longer hidden. It’s a draft, so guests will see it once its owner publishes it.`;
}
