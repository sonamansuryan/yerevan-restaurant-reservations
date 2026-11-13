import type { ReactElement } from "react";
import { useNavigate } from "react-router";

import { LinkButton } from "@/components/Button";
import { OfficeAccount } from "@/components/OfficeAccount";
import { OfficeLayout } from "@/components/OfficeLayout";
import { useAccount } from "@/features/auth/hooks/useAccount";
import {
  DashboardLoadFailed,
  DashboardLoading,
  NoRestaurantsYet,
} from "@/features/dashboard/components/DashboardStates";
import { OwnerNav } from "@/features/dashboard/components/OwnerNav";
import { RestaurantList } from "@/features/dashboard/components/RestaurantList";
import { useOwnerRestaurants } from "@/features/dashboard/hooks/useOwnerRestaurants";

/** The owner's own restaurants, published or not: the way into each one's dashboard. */
export function DashboardPage(): ReactElement {
  const navigate = useNavigate();
  const account = useAccount();
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
    <OfficeLayout nav={<OwnerNav account={<OfficeAccount account={account} />} />}>
      <title>Your restaurants · Seghan</title>
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <div>
          <h1 className="font-grotesque text-part font-bold">Your restaurants</h1>
          <p className="mt-1 text-input text-ink-secondary">
            Open a restaurant to manage its reservations, tables and hours.
          </p>
        </div>
        {list && list.length > 0 && <LinkButton to="/dashboard/new">Add a restaurant</LinkButton>}
      </div>
      <div className="mt-8">{body}</div>
    </OfficeLayout>
  );
}
