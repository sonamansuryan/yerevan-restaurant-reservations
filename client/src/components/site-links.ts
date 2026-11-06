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

// The pages behind most of these links arrive in later tasks. Until then, they show the not-found
// page, which is why nothing here needs changing when each page is built.
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

// The query matches the `district` filter of GET /api/restaurants.
export const districts = [
  { to: "/restaurants?district=KENTRON", label: "Kentron" },
  { to: "/restaurants?district=ARABKIR", label: "Arabkir" },
  { to: "/restaurants?district=NOR_NORK", label: "Nor Nork" },
  { to: "/restaurants?district=MALATIA_SEBASTIA", label: "Malatia-Sebastia" },
];
