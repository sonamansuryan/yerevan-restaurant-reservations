import type { ReactElement } from "react";

import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Spinner } from "@/components/Spinner";

// What the dashboard shows before it has the owner's data, or when there's none. These hold only
// the content, so /design can show them. EmptyState and ErrorState keep their protected look:
// only their words are passed in.

/** While something loads, such as "Loading your restaurants". */
export function DashboardLoading({ label }: { label: string }): ReactElement {
  return (
    <div className="flex min-h-40 items-center justify-center">
      <Spinner label={label} />
    </div>
  );
}

interface LoadFailedProps {
  /** What couldn't be loaded, such as "your restaurants". */
  what: string;
  onRetry: () => void;
  retrying: boolean;
}

export function DashboardLoadFailed({ what, onRetry, retrying }: LoadFailedProps): ReactElement {
  return (
    <div className="flex flex-col items-center">
      <ErrorState
        title="Our apologies"
        description={`We couldn’t load ${what}.`}
        onRetry={onRetry}
        retrying={retrying}
        className="w-full max-w-120"
      />
    </div>
  );
}

export function NoRestaurantsYet({ onAdd }: { onAdd: () => void }): ReactElement {
  return (
    <EmptyState
      title="No restaurants yet"
      description="Add your restaurant, then publish it when it’s ready for guests."
      action={{ label: "Add a restaurant", onClick: onAdd }}
    />
  );
}

export function NoBookingsThatDay(): ReactElement {
  return <EmptyState title="No bookings" description="Nothing is booked for this day yet." />;
}
