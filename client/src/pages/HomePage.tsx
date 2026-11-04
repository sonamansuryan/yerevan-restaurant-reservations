import type { ReactElement } from "react";

export function HomePage(): ReactElement {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold">Yerevan Reservations</h1>
      <p className="mt-2 text-gray-600">The client is set up.</p>
    </main>
  );
}
