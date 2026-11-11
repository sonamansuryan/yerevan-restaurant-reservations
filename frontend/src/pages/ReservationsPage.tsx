import type { ReactElement } from "react";

import { PageContainer } from "@/components/PageContainer";
import { MyReservations } from "@/features/reservations/components/MyReservations";
import { useMyReservations } from "@/features/reservations/hooks/useMyReservations";
import type { ReservationsWhen } from "@/features/reservations/reservations";

/** /reservations and /reservations/past: the signed-in guest's own bookings. */
export function ReservationsPage({ when = "upcoming" }: { when?: ReservationsWhen }): ReactElement {
  const reservations = useMyReservations(when);
  return (
    <PageContainer className="py-section-sm">
      <title>
        {when === "upcoming" ? "My reservations · Seghan" : "Past reservations · Seghan"}
      </title>
      <h1 className="font-display text-section">My reservations</h1>
      <MyReservations {...reservations} className="mt-6" />
    </PageContainer>
  );
}
