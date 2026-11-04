import type { ReactElement } from "react";

import { ApiStatus } from "@/features/health/components/ApiStatus";

export function HomePage(): ReactElement {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold">Yerevan Reservations</h1>
      <ApiStatus />
    </main>
  );
}
