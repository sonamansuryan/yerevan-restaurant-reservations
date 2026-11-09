import type { ReactElement } from "react";

import { useApiHealth } from "@/features/health/hooks/useApiHealth";

export function ApiStatus(): ReactElement {
  const { data, error, errorUpdateCount, isFetching, refetch } = useApiHealth();
  // A retry clears `error` while it runs. Staying on the error view keeps the button on the page,
  // so a keyboard user doesn't lose their place.
  const isRetrying = isFetching && errorUpdateCount > 0;

  if (error || (isRetrying && !data)) {
    return (
      <div role="alert" className="mt-2">
        <p className="font-medium text-red-700">API: unavailable</p>
        <p className="mt-1 text-gray-600">{error?.message ?? "Checking again…"}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isRetrying}
          className="mt-3 rounded border border-gray-400 px-3 py-1 text-sm disabled:opacity-50"
        >
          {isRetrying ? "Checking…" : "Try again"}
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <p role="status" className="mt-2 text-gray-600">
        Checking the API…
      </p>
    );
  }

  return (
    <p role="status" className="mt-2 text-gray-600">
      API: {data.status}
    </p>
  );
}
