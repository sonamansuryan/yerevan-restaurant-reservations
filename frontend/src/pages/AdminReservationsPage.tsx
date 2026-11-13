import type { ReactElement } from "react";

import { PartHeader } from "@/components/PartHeader";
import { AdminReservations } from "@/features/admin/components/AdminReservations";
import { useAdminReservations } from "@/features/admin/hooks/useAdminReservations";

/** /admin/reservations: every booking, at every restaurant. */
export function AdminReservationsPage(): ReactElement {
  const reservations = useAdminReservations();
  return (
    <>
      <title>Reservations · Admin · Seghan</title>
      <PartHeader
        title="Reservations"
        description="Every booking, at every restaurant, the latest first."
        className="mb-6"
      />
      <AdminReservations {...reservations} />
    </>
  );
}
