import type { ReactElement } from "react";

import { AdminRestaurants } from "@/features/admin/components/AdminRestaurants";
import { useAdminRestaurants } from "@/features/admin/hooks/useAdminRestaurants";

/** /admin: every restaurant, and hiding one from guests. */
export function AdminRestaurantsPage(): ReactElement {
  const restaurants = useAdminRestaurants();
  return (
    <>
      <title>Restaurants · Admin · Seghan</title>
      <h2 className="sr-only">Restaurants</h2>
      <AdminRestaurants {...restaurants} />
    </>
  );
}
