import { useMemo } from "react";
import type { ReactElement } from "react";
import { useLocation } from "react-router";

import { PartHeader } from "@/components/PartHeader";
import { JustAddedNotice } from "@/features/dashboard/components/JustAddedNotice";
import { PublishPanel } from "@/features/dashboard/components/PublishPanel";
import { RestaurantForm } from "@/features/dashboard/components/RestaurantForm";
import { useDashboardRestaurant } from "@/features/dashboard/hooks/useDashboardRestaurant";
import { useUpdateRestaurant } from "@/features/dashboard/hooks/useSaveRestaurant";
import { wasJustAdded } from "@/features/dashboard/justAdded";
import { restaurantFields } from "@/features/dashboard/schemas";

/** A restaurant's details, and whether guests can see it. */
export function DashboardInformationPage(): ReactElement {
  const restaurant = useDashboardRestaurant();
  const { state } = useLocation();
  // Two separate requests, so publishing never shows the form as sending, or the other way round.
  const save = useUpdateRestaurant(restaurant.id);
  const publish = useUpdateRestaurant(restaurant.id);
  // A new object only when the restaurant changes, so the form resets only after a real change.
  const values = useMemo(() => restaurantFields(restaurant), [restaurant]);

  return (
    <>
      <title>{`Restaurant info · ${restaurant.name} · Seghan`}</title>
      <PartHeader
        title="Restaurant info"
        description="What guests see on your page, and whether they can find it."
        className="mb-6"
      />
      <div className="flex flex-col gap-6">
        {wasJustAdded(state) && <JustAddedNotice restaurantId={restaurant.id} />}
        <PublishPanel
          isPublished={restaurant.isPublished}
          hiddenBySeghan={restaurant.hiddenBySeghan}
          onChange={(isPublished) => publish.mutate({ isPublished })}
          pending={publish.isPending}
          error={publish.error}
        />
        <RestaurantForm
          values={values}
          submitLabel="Save changes"
          onSubmit={(request) => save.mutate(request)}
          pending={save.isPending}
          error={save.error}
          saved={save.isSuccess}
        />
      </div>
    </>
  );
}
