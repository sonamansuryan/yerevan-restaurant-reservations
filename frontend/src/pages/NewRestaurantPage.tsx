import type { ReactElement } from "react";
import { useNavigate } from "react-router";

import { LinkButton } from "@/components/Button";
import { PageContainer } from "@/components/PageContainer";
import { RestaurantForm } from "@/features/dashboard/components/RestaurantForm";
import { useCreateRestaurant } from "@/features/dashboard/hooks/useSaveRestaurant";
import { JUST_ADDED } from "@/features/dashboard/justAdded";
import { NEW_RESTAURANT } from "@/features/dashboard/schemas";

/** A new restaurant. Once it's saved, its own dashboard opens, on its information. */
export function NewRestaurantPage(): ReactElement {
  const navigate = useNavigate();
  const create = useCreateRestaurant();

  return (
    <PageContainer className="py-section-sm">
      <title>Add a restaurant · Seghan</title>
      <LinkButton variant="link" to="/dashboard">
        Your restaurants
      </LinkButton>
      <h1 className="mt-3 font-display text-section">Add a restaurant</h1>
      <p className="mt-3 max-w-160 text-body text-ink-secondary">
        Only you can see it until you publish it.
      </p>
      <div className="mt-10">
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
    </PageContainer>
  );
}
