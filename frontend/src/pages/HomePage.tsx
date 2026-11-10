import type { ReactElement } from "react";

import { LinkButton } from "@/components/Button";
import { PageContainer } from "@/components/PageContainer";
import { EveningOverYerevan } from "@/features/home/components/EveningOverYerevan";
import { FeaturedRestaurants } from "@/features/restaurants/components/FeaturedRestaurants";
import { RestaurantSearch } from "@/features/restaurants/components/RestaurantSearch";
import {
  FEATURED_COUNT,
  useFeaturedRestaurants,
} from "@/features/restaurants/hooks/useFeaturedRestaurants";

export function HomePage(): ReactElement {
  const featured = useFeaturedRestaurants();
  const total = featured.data?.meta.total ?? 0;

  return (
    <PageContainer className="py-section-sm">
      {/* Branding, so the headline may be expressive: wine italic on its last word, and a full stop.
          Beside it from 1024px, and under the search on narrower screens, an evening over Yerevan
          shows its second line: the city's restaurants lighting up. */}
      <section
        aria-labelledby="home-title"
        className="md:pt-6 lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-12"
      >
        <div>
          <p className="text-eyebrow text-ink-muted uppercase">Yerevan</p>
          <h1 id="home-title" className="mt-3 font-display text-hero text-balance">
            Choose your <em className="text-accent">Seghan.</em>
          </h1>
          <p className="mt-5 max-w-130 text-lead text-pretty text-ink-secondary">
            Seghan means table in Armenian. Find yours at restaurants across the city.
          </p>
          <RestaurantSearch className="mt-10 max-w-140" />
        </div>
        <EveningOverYerevan className="mx-auto mt-14 w-full max-w-80 lg:mt-0 lg:max-w-100" />
      </section>

      <section
        aria-labelledby="featured-title"
        className="mt-section-sm border-t border-line pt-8 lg:mt-section-md"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 id="featured-title" className="font-display text-section">
            A few places to start
          </h2>
          {total > 0 && (
            <LinkButton variant="link" to="/restaurants">
              {total > FEATURED_COUNT ? `See all ${total} restaurants` : "Browse restaurants"}
            </LinkButton>
          )}
        </div>
        <FeaturedRestaurants
          results={featured.data}
          failed={featured.isError}
          retrying={featured.isFetching && featured.errorUpdateCount > 0}
          onRetry={() => void featured.refetch()}
          className="mt-8"
        />
      </section>
    </PageContainer>
  );
}
