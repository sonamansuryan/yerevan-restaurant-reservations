import type { AuthUser } from "@/types/api";

export interface SiteLink {
  to: string;
  label: string;
  /** Shown after the dotted line in the mobile menu. */
  note: string;
  /**
   * False when the link doesn't stand for a whole page. NavLink ignores the query string, so
   * For restaurants would otherwise be marked as current on the plain sign-up page too.
   */
  marksPage?: boolean;
}

export const discover: SiteLink = {
  to: "/restaurants",
  label: "Discover",
  note: "All of Yerevan",
};

export const forRestaurants: SiteLink = {
  to: "/register?role=owner",
  label: "For restaurants",
  note: "List yours",
  marksPage: false,
};

export const signIn: SiteLink = { to: "/login", label: "Sign in", note: "Your reservations" };

export const myReservations: SiteLink = {
  to: "/reservations",
  label: "My reservations",
  note: "Your bookings",
};

export const dashboard: SiteLink = {
  to: "/dashboard",
  label: "Dashboard",
  note: "Your restaurants",
};

/**
 * The main links, by who's signed in: a guest's bookings, an owner's dashboard, and for anyone
 * else the page for restaurants. While the app is still asking who's signed in, only Discover
 * shows, so a wrong link never flashes up.
 */
export function mainLinks(user: AuthUser | null | undefined): SiteLink[] {
  if (user === undefined) return [discover];
  if (user === null) return [discover, forRestaurants];
  if (user.role === "CUSTOMER") return [discover, myReservations];
  if (user.role === "OWNER") return [discover, dashboard];
  return [discover];
}

// The query matches the `district` filter of GET /api/restaurants.
export const districts = [
  { to: "/restaurants?district=KENTRON", label: "Kentron" },
  { to: "/restaurants?district=ARABKIR", label: "Arabkir" },
  { to: "/restaurants?district=NOR_NORK", label: "Nor Nork" },
  { to: "/restaurants?district=MALATIA_SEBASTIA", label: "Malatia-Sebastia" },
];
