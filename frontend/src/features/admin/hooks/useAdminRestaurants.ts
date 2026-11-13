import { useEffect, useState } from "react";

import { readRestaurantFilters } from "@/features/admin/admin";
import type { AdminRestaurantFilters } from "@/features/admin/admin";
import type { AdminRestaurantsProps } from "@/features/admin/components/AdminRestaurants";
import { useAdminList } from "@/features/admin/hooks/useAdminList";
import { useRestaurantVisibility } from "@/features/admin/hooks/useRestaurantVisibility";
import { yerevanToday } from "@/lib/time";
import type { AdminRestaurant } from "@/types/api";

/** The admin's restaurants, /admin: the list in the address, and hiding or showing one again. */
export function useAdminRestaurants(): AdminRestaurantsProps {
  const { filters, onFiltersChange, list, hrefFor } = useAdminList<
    AdminRestaurant,
    AdminRestaurantFilters
  >("restaurants", readRestaurantFilters);
  // Read once, when the page opens, so the days don't change under someone at midnight.
  const [today] = useState(() => yerevanToday());
  const visibility = useRestaurantVisibility();
  const { reset } = visibility;

  // What was said about the last change belongs to the list it was made on.
  useEffect(() => {
    reset();
  }, [filters, reset]);

  return {
    filters,
    onFiltersChange,
    list,
    hrefFor,
    today,
    changingId: visibility.isPending ? visibility.variables.restaurant.id : null,
    changed: visibility.data ?? null,
    refusal: visibility.error,
    onHide: (restaurant) => visibility.mutate({ restaurant, hidden: true }),
    onShow: (restaurant) => visibility.mutate({ restaurant, hidden: false }),
  };
}
