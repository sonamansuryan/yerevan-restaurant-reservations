import type { ReactElement } from "react";

import { PageContainer } from "@/components/PageContainer";

/**
 * A stand-in at the address the footer already links to, so the guard has a page to protect. Task
 * 8.3 builds the real list of bookings here.
 */
export function ReservationsPage(): ReactElement {
  return (
    <PageContainer className="py-section-sm">
      <title>My reservations · Seghan</title>
      <h1 className="font-display text-section">My reservations</h1>
      <p className="mt-3 text-body text-ink-secondary">Your bookings will be listed here.</p>
    </PageContainer>
  );
}
