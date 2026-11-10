import { useOutletContext } from "react-router";

import type { OwnerRestaurant } from "@/types/api";

/** What the restaurant's dashboard layout hands to each of its parts. */
export interface DashboardRestaurantContext {
  restaurant: OwnerRestaurant;
}

/**
 * The restaurant whose dashboard is open. The layout has already loaded it, and its parts only
 * render once it has, so they never wait for it themselves.
 */
export function useDashboardRestaurant(): OwnerRestaurant {
  return useOutletContext<DashboardRestaurantContext>().restaurant;
}
