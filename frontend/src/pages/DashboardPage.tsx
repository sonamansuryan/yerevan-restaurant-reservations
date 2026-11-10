import type { ReactElement } from "react";
import { useNavigate } from "react-router";

import { LinkButton } from "@/components/Button";
import { PageContainer } from "@/components/PageContainer";
import {
  DashboardLoadFailed,
  DashboardLoading,
  NoRestaurantsYet,
} from "@/features/dashboard/components/DashboardStates";
import { RestaurantList } from "@/features/dashboard/components/RestaurantList";
import { useOwnerRestaurants } from "@/features/dashboard/hooks/useOwnerRestaurants";

/** The owner's own restaurants, published or not: the way into each one's dashboard. */
export function DashboardPage(): ReactElement {
  const navigate = useNavigate();
  const restaurants = useOwnerRestaurants();
  const list = restaurants.data?.data;
  // A retry clears the error while it runs. Staying on the error keeps Try again on the page.
  const retrying = restaurants.isFetching && restaurants.errorUpdateCount > 0;

  let body: ReactElement;
  if (list && list.length > 0) {
    body = <RestaurantList restaurants={list} />;
  } else if (list) {
    body = <NoRestaurantsYet onAdd={() => void navigate("/dashboard/new")} />;
  } else if (restaurants.isError || retrying) {
    body = (
      <DashboardLoadFailed
        what="your restaurants"
        onRetry={() => void restaurants.refetch()}
        retrying={retrying}
      />
    );
  } else {
    body = <DashboardLoading label="Loading your restaurants" />;
  }

  return (
    <PageContainer className="py-section-sm">
      <title>Your restaurants · Seghan</title>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <h1 className="font-display text-section">Your restaurants</h1>
        {list && list.length > 0 && <LinkButton to="/dashboard/new">Add a restaurant</LinkButton>}
      </div>
      <div className="mt-8">{body}</div>
    </PageContainer>
  );
}
