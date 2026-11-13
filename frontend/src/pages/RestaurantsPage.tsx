import type { ReactElement } from "react";

import { PageContainer } from "@/components/PageContainer";
import { isFiltered } from "@/features/restaurants/browseFilters";
import { BrowseResults } from "@/features/restaurants/components/BrowseResults";
import { RestaurantFilters } from "@/features/restaurants/components/RestaurantFilters";
import { useBrowseFilters } from "@/features/restaurants/hooks/useBrowseFilters";
import { useRestaurants } from "@/features/restaurants/hooks/useRestaurants";

export function RestaurantsPage(): ReactElement {
  const { filters, setFilters, hrefFor } = useBrowseFilters();
  const restaurants = useRestaurants(filters);

  return (
    <PageContainer className="py-section-sm">
      <title>Restaurants · Seghan</title>
      <p className="text-eyebrow text-ink-muted uppercase">Yerevan</p>
      <h1 className="mt-3 font-display text-hero">Restaurants</h1>
      {/* A new key when the address's search changes, such as after Back, so the box follows. */}
      <RestaurantFilters
        key={filters.q ?? ""}
        filters={filters}
        onChange={setFilters}
        className="mt-10"
      />
      <BrowseResults
        results={restaurants.data}
        failed={restaurants.isError}
        retrying={restaurants.isFetching && restaurants.errorUpdateCount > 0}
        onRetry={() => void restaurants.refetch()}
        updating={restaurants.isPlaceholderData}
        filtered={isFiltered(filters)}
        onClearFilters={() => setFilters({ page: 1, sort: filters.sort })}
        onFirstPage={() => setFilters({ ...filters, page: 1 })}
        hrefFor={hrefFor}
        className="mt-12"
      />
    </PageContainer>
  );
}
