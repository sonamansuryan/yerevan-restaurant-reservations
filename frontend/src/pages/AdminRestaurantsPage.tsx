import type { ReactElement } from "react";

import { PartHeader } from "@/components/PartHeader";
import { AdminRestaurants } from "@/features/admin/components/AdminRestaurants";
import { useAdminRestaurants } from "@/features/admin/hooks/useAdminRestaurants";

/** /admin: every restaurant, and hiding one from guests. */
export function AdminRestaurantsPage(): ReactElement {
  const restaurants = useAdminRestaurants();
  return (
    <>
      <title>Restaurants · Admin · Seghan</title>
      <PartHeader
        title="Restaurants"
        description="Every restaurant on Seghan, drafts and hidden ones too."
        className="mb-6"
      />
      <AdminRestaurants {...restaurants} />
    </>
  );
}
