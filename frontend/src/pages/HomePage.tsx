import { useState } from "react";
import type { ReactElement } from "react";

import { LinkButton } from "@/components/Button";
import { PageContainer } from "@/components/PageContainer";
import { districts } from "@/components/site-links";
import { useAccount } from "@/features/auth/hooks/useAccount";
import { RestaurantHeart } from "@/features/favorites/components/RestaurantHeart";
import { HomeHero } from "@/features/home/components/HomeHero";
import { Neighborhoods } from "@/features/home/components/Neighborhoods";
import { OwnersBand } from "@/features/home/components/OwnersBand";
import { TonightTimes } from "@/features/home/components/TonightTimes";
import { useAreaCounts } from "@/features/home/hooks/useAreaCounts";
import { useHomeRestaurants } from "@/features/home/hooks/useHomeRestaurants";
import { useTonight } from "@/features/home/hooks/useTonight";
import { FeaturedRestaurants } from "@/features/restaurants/components/FeaturedRestaurants";
import { tableQuery } from "@/features/restaurants/tableSearch";
import { yerevanClock, yerevanToday } from "@/lib/time";

/**
 * The home page, as the export lays it out: the dark opening with the search for a table, two rows
 * of restaurants with tonight's free times, the neighborhoods to explore, and for anyone signed out,
 * an invitation to restaurant owners.
 */
export function HomePage(): ReactElement {
  const restaurants = useHomeRestaurants();
  const total = restaurants.data?.meta.total ?? 0;
  const shown = restaurants.data?.data.length ?? 0;
  const counts = useAreaCounts(districts.map(({ district }) => district));
  const { user } = useAccount();
  // Read once, when the page opens: a page has to render the same way each time.
  const [today] = useState(() => yerevanToday());
  const [query] = useState(() => tableQuery({}, today, yerevanClock()));

  return (
    <>
      <HomeHero total={restaurants.data?.meta.total} query={query} today={today} />
      <PageContainer className="flex flex-col gap-16 pt-14 pb-6">
        <section aria-labelledby="tonight-title">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div>
              <h2 id="tonight-title" className="font-grotesque text-heading font-bold">
                Available tonight for 2
              </h2>
              <p className="mt-1.5 text-input text-ink-secondary">
                Choose a time to book. You only need an account at the last step.
              </p>
            </div>
            {total > 0 && (
              <LinkButton variant="link" to="/restaurants" className="text-input">
                {total > shown ? `See all ${total}` : "Browse restaurants"}
              </LinkButton>
            )}
          </div>
          <FeaturedRestaurants
            results={restaurants.data}
            failed={restaurants.isError}
            retrying={restaurants.retrying}
            onRetry={restaurants.refetch}
            timesFor={(restaurant) => <Tonight slug={restaurant.slug} name={restaurant.name} />}
            saveFor={(restaurant) => (
              <RestaurantHeart slug={restaurant.slug} name={restaurant.name} />
            )}
            className="mt-6"
          />
        </section>

        {/* The header's Neighborhoods leads here. */}
        <section id="neighborhoods" aria-labelledby="areas-title">
          <h2 id="areas-title" className="font-grotesque text-heading font-bold">
            Explore by neighborhood
          </h2>
          <Neighborhoods
            areas={districts.map((area, index) => ({
              to: area.to,
              label: area.label,
              count: counts[index],
            }))}
            className="mt-6"
          />
        </section>

        {/* As the header's For restaurants: only for someone signed out, never while checking. */}
        {user === null && <OwnersBand />}
      </PageContainer>
    </>
  );
}

/** One card's times: its own request, which the restaurant's page reuses once it's opened. */
function Tonight({ slug, name }: { slug: string; name: string }): ReactElement {
  const { date, state } = useTonight(slug);
  return <TonightTimes slug={slug} name={name} date={date} state={state} />;
}
