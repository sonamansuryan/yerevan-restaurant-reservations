import type { ReactElement } from "react";

import { PageContainer } from "@/components/PageContainer";

/**
 * A stand-in at the address the footer already links to, so the guard has an owner page to protect.
 * Step 4 builds the real dashboard here.
 */
export function DashboardPage(): ReactElement {
  return (
    <PageContainer className="py-section-sm">
      <title>Dashboard · Seghan</title>
      <h1 className="font-display text-section">Dashboard</h1>
      <p className="mt-3 text-body text-ink-secondary">
        Your restaurant’s tables, opening hours and bookings will be managed here.
      </p>
    </PageContainer>
  );
}
