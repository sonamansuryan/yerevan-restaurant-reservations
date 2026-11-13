import type { ReactElement } from "react";

import { PageContainer } from "@/components/PageContainer";
import { SavedRestaurants } from "@/features/favorites/components/SavedRestaurants";
import { useSavedPreview } from "@/features/favorites/hooks/useSavedPreview";
import { MyReservations } from "@/features/reservations/components/MyReservations";
import { useMyReservations } from "@/features/reservations/hooks/useMyReservations";
import type { ReservationsWhen } from "@/features/reservations/reservations";

/**
 * /reservations and /reservations/past: the signed-in guest's own bookings, with their saved
 * restaurants beside them from 1024px, and after them on a phone, as the export lays it out.
 */
export function ReservationsPage({ when = "upcoming" }: { when?: ReservationsWhen }): ReactElement {
  const reservations = useMyReservations(when);
  const saved = useSavedPreview();
  return (
    <PageContainer className="grid items-start gap-10 pt-10 pb-section-sm lg:grid-cols-[minmax(0,1fr)_21rem]">
      <title>
        {when === "upcoming" ? "My reservations · Seghan" : "Past reservations · Seghan"}
      </title>
      <div className="min-w-0">
        <h1 className="font-grotesque text-page-title font-bold">My reservations</h1>
        <MyReservations {...reservations} className="mt-6" />
      </div>
      <SavedRestaurants saved={saved} />
    </PageContainer>
  );
}
