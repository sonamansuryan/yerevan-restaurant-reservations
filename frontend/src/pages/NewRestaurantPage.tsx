import type { ReactElement } from "react";
import { useNavigate } from "react-router";

import { OfficeAccount } from "@/components/OfficeAccount";
import { OfficeLayout } from "@/components/OfficeLayout";
import { useAccount } from "@/features/auth/hooks/useAccount";
import { OwnerNav } from "@/features/dashboard/components/OwnerNav";
import { RestaurantForm } from "@/features/dashboard/components/RestaurantForm";
import { useCreateRestaurant } from "@/features/dashboard/hooks/useSaveRestaurant";
import { JUST_ADDED } from "@/features/dashboard/justAdded";
import { NEW_RESTAURANT } from "@/features/dashboard/schemas";

/** A new restaurant. Once it's saved, its own dashboard opens, on its information. */
export function NewRestaurantPage(): ReactElement {
  const navigate = useNavigate();
  const account = useAccount();
  const create = useCreateRestaurant();

  return (
    <OfficeLayout nav={<OwnerNav account={<OfficeAccount account={account} />} />}>
      <title>Add a restaurant · Seghan</title>
      <h1 className="font-grotesque text-part font-bold">Add a restaurant</h1>
      <p className="mt-1 max-w-160 text-input text-ink-secondary">
        Only you can see it until you publish it.
      </p>
      <div className="mt-8">
        <RestaurantForm
          values={NEW_RESTAURANT}
          submitLabel="Add the restaurant"
          pending={create.isPending}
          error={create.error}
          onSubmit={(request) =>
            create.mutate(request, {
              onSuccess: (restaurant) =>
                void navigate(`/dashboard/${restaurant.id}/information`, { state: JUST_ADDED }),
            })
          }
        />
      </div>
    </OfficeLayout>
  );
}
