import type { ReactElement } from "react";

import { PageContainer } from "@/components/PageContainer";
import { ApiStatus } from "@/features/health/components/ApiStatus";

export function HomePage(): ReactElement {
  return (
    <PageContainer className="py-section-sm">
      <h1 className="font-display text-section">Seghan</h1>
      <ApiStatus />
    </PageContainer>
  );
}
