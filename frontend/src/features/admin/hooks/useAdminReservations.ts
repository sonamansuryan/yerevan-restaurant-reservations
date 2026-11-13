import { useState } from "react";

import { readReservationFilters } from "@/features/admin/admin";
import type { AdminReservationFilters } from "@/features/admin/admin";
import type { AdminReservationsProps } from "@/features/admin/components/AdminReservations";
import { useAdminList } from "@/features/admin/hooks/useAdminList";
import { yerevanToday } from "@/lib/time";
import type { AdminReservation } from "@/types/api";

/** Every booking, /admin/reservations, filtered as the address says. */
export function useAdminReservations(): AdminReservationsProps {
  const part = useAdminList<AdminReservation, AdminReservationFilters>(
    "reservations",
    readReservationFilters,
  );
  // Read once, when the page opens, so the days don't change under someone at midnight.
  const [today] = useState(() => yerevanToday());
  return { ...part, today };
}
