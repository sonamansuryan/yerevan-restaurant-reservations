import { useId, useMemo } from "react";
import type { ReactElement } from "react";

import { Button } from "@/components/Button";
import { PartHeader } from "@/components/PartHeader";
import {
  DashboardLoadFailed,
  DashboardLoading,
} from "@/features/dashboard/components/DashboardStates";
import { OpeningHoursForm } from "@/features/dashboard/components/OpeningHoursForm";
import { useDashboardRestaurant } from "@/features/dashboard/hooks/useDashboardRestaurant";
import { useOpeningHours, useSaveOpeningHours } from "@/features/dashboard/hooks/useOpeningHours";
import { weekFields } from "@/features/dashboard/hours";

/**
 * A restaurant's week of opening hours, saved all at once with Save changes, in the part's header
 * as the export has it.
 */
export function DashboardHoursPage(): ReactElement {
  const formId = useId();
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
        id={formId}
        values={values}
        onSubmit={({ hours }) => save.mutate(hours)}
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
      <PartHeader
        title="Opening hours"
        description="Guests can book only within these hours, except at the times you block."
        action={
          values && (
            <Button type="submit" form={formId} variant="accent" loading={save.isPending}>
              Save changes
            </Button>
          )
        }
        className="mb-6"
      />
      {body}
    </>
  );
}
