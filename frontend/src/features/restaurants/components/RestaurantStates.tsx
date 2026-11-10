import type { ReactElement } from "react";

import { ErrorState } from "@/components/ErrorState";
import { Spinner } from "@/components/Spinner";

// What a restaurant's page shows before it has the restaurant. These hold only the content, so
// /design can show them. A restaurant that isn't there gets the not-found page instead.

export function RestaurantLoading(): ReactElement {
  return <Spinner label="Loading the restaurant" />;
}

/** The protected ErrorState, with only its words passed in. */
export function RestaurantLoadFailed({
  onRetry,
  retrying,
}: {
  onRetry: () => void;
  retrying: boolean;
}): ReactElement {
  return (
    <ErrorState
      title="Our apologies"
      description="We couldn’t load this restaurant."
      onRetry={onRetry}
      retrying={retrying}
      className="w-full max-w-120"
    />
  );
}
