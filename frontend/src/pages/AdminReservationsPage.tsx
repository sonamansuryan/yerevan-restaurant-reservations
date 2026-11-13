import type { ReactElement } from "react";

import { AdminReservations } from "@/features/admin/components/AdminReservations";
import { useAdminReservations } from "@/features/admin/hooks/useAdminReservations";

/** /admin/reservations: every booking, at every restaurant. */
export function AdminReservationsPage(): ReactElement {
  const reservations = useAdminReservations();
  return (
    <>
      <title>Reservations · Admin · Seghan</title>
      <h2 className="sr-only">Reservations</h2>
      <AdminReservations {...reservations} />
    </>
  );
}
