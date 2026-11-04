import type { ReactElement } from "react";
import { Link } from "react-router";

export function NotFoundPage(): ReactElement {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <Link to="/" className="mt-2 inline-block text-blue-700 underline">
        Back to the home page
      </Link>
    </main>
  );
}
