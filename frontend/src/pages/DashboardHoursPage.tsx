import { useMemo } from "react";
import type { ReactElement } from "react";

import {
  DashboardLoadFailed,
  DashboardLoading,
} from "@/features/dashboard/components/DashboardStates";
import { OpeningHoursForm } from "@/features/dashboard/components/OpeningHoursForm";
import { useDashboardRestaurant } from "@/features/dashboard/hooks/useDashboardRestaurant";
import { useOpeningHours, useSaveOpeningHours } from "@/features/dashboard/hooks/useOpeningHours";
import { weekFields } from "@/features/dashboard/hours";

/** A restaurant's week of opening hours, saved all at once. */
export function DashboardHoursPage(): ReactElement {
  const restaurant = useDashboardRestaurant();
  const week = useOpeningHours(restaurant.id);
  const save = useSaveOpeningHours(restaurant.id);
  // A new object only when the saved week changes, so the form resets only after a real change.
  const values = useMemo(() => (week.data ? weekFields(week.data) : null), [week.data]);
  const retrying = week.isFetching && week.errorUpdateCount > 0;

  let body: ReactElement;
  if (values) {
    body = (
      <OpeningHoursForm
        values={values}
        onSubmit={({ hours }) => save.mutate(hours)}
        pending={save.isPending}
        error={save.error}
        saved={save.isSuccess}
      />
    );
  } else if (week.isError || retrying) {
    body = (
      <DashboardLoadFailed
        what="the opening hours"
        onRetry={() => void week.refetch()}
        retrying={retrying}
      />
    );
  } else {
    body = <DashboardLoading label="Loading the opening hours" />;
  }

  return (
    <>
      <title>{`Opening hours · ${restaurant.name} · Seghan`}</title>
      <h2 className="sr-only">Opening hours</h2>
      {body}
    </>
  );
}
