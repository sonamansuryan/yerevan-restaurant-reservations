import type { AuthUser, District } from "@/types/api";

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

export const explore: SiteLink = {
  to: "/restaurants",
  label: "Explore",
  note: "All of Yerevan",
};

/** The home page's neighborhoods, as the export's header has them. It isn't a page of its own. */
export const neighborhoods: SiteLink = {
  to: "/#neighborhoods",
  label: "Neighborhoods",
  note: "Kentron, Arabkir and more",
  marksPage: false,
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

export const myFavorites: SiteLink = {
  to: "/favorites",
  label: "My favorites",
  note: "Places you saved",
};

export const dashboard: SiteLink = {
  to: "/dashboard",
  label: "Dashboard",
  note: "Your restaurants",
};

export const admin: SiteLink = {
  to: "/admin",
  label: "Admin",
  note: "Restaurants and bookings",
};

/**
 * The main links, by who's signed in, as the export's header has them: Explore, Neighborhoods and
 * My reservations, which asks anyone signed out to sign in first. A guest also has their
 * favorites, an owner the dashboard and Seghan's team the admin area. While the app is still asking
 * who's signed in, only the first two show, so a wrong link never flashes up.
 */
export function mainLinks(user: AuthUser | null | undefined): SiteLink[] {
  if (user === undefined) return [explore, neighborhoods];
  if (user === null) return [explore, neighborhoods, myReservations];
  if (user.role === "CUSTOMER") return [explore, neighborhoods, myReservations, myFavorites];
  if (user.role === "OWNER") return [explore, neighborhoods, dashboard];
  return [explore, neighborhoods, admin];
}

/**
 * Whether the mobile menu offers Find a table: to guests and anyone signed out, who are the ones
 * who book. Restaurant owners and Seghan's admins never do, so they don't get it. While the app is
 * still asking who's signed in, it already shows, so a guest never waits for it.
 */
export function offersReserve(user: AuthUser | null | undefined): boolean {
  return !user || user.role === "CUSTOMER";
}

// The query matches the `district` filter of GET /api/restaurants. The home page counts each one.
export const districts: { to: string; label: string; district: District }[] = [
  { to: "/restaurants?district=KENTRON", label: "Kentron", district: "KENTRON" },
  { to: "/restaurants?district=ARABKIR", label: "Arabkir", district: "ARABKIR" },
  { to: "/restaurants?district=NOR_NORK", label: "Nor Nork", district: "NOR_NORK" },
  {
    to: "/restaurants?district=MALATIA_SEBASTIA",
    label: "Malatia-Sebastia",
    district: "MALATIA_SEBASTIA",
  },
];
