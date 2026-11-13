import { useState } from "react";
import type { ReactElement } from "react";

import { PageContainer } from "@/components/PageContainer";
import { RestaurantHeart } from "@/features/favorites/components/RestaurantHeart";
import { isFiltered } from "@/features/restaurants/browseFilters";
import { BrowseResults } from "@/features/restaurants/components/BrowseResults";
import { FreeTimes } from "@/features/restaurants/components/FreeTimes";
import { RestaurantFilters } from "@/features/restaurants/components/RestaurantFilters";
import { useBrowseFilters } from "@/features/restaurants/hooks/useBrowseFilters";
import { useFreeTimes } from "@/features/restaurants/hooks/useFreeTimes";
import { useRestaurants } from "@/features/restaurants/hooks/useRestaurants";
import { dayLink, freeTimeLink, tableQuery, whenWords } from "@/features/restaurants/tableSearch";
import type { TableQuery } from "@/features/restaurants/tableSearch";
import { yerevanClock, yerevanToday } from "@/lib/time";

export function RestaurantsPage(): ReactElement {
  const { filters, setFilters, hrefFor } = useBrowseFilters();
  const restaurants = useRestaurants(filters);
  // Read once, when the page opens: a page has to render the same way each time.
  const [today] = useState(() => yerevanToday());
  const [now] = useState(() => yerevanClock());
  const query = tableQuery(filters, today, now);

  return (
    <PageContainer className="pt-10 pb-section-sm md:pt-14">
      <title>Restaurants · Seghan</title>
      <h1 className="font-grotesque text-page-title font-bold">Restaurants</h1>
      <p className="mt-2 text-input text-ink-secondary">
        Find a table at a restaurant in Yerevan. Each shows its free times nearest yours.
      </p>
      {/* A new key when the address's search changes, such as after Back, so the bar follows. */}
      <RestaurantFilters
        key={[filters.q, filters.date, filters.time, filters.guests].join("|")}
        filters={filters}
        onChange={setFilters}
        query={query}
        today={today}
        className="mt-8"
      />
      <BrowseResults
        results={restaurants.data}
        failed={restaurants.isError}
        retrying={restaurants.isFetching && restaurants.errorUpdateCount > 0}
        onRetry={() => void restaurants.refetch()}
        updating={restaurants.isPlaceholderData}
        filtered={isFiltered(filters)}
        // The table looked for isn't a filter, so it stays.
        onClearFilters={() =>
          setFilters({
            page: 1,
            sort: filters.sort,
            date: filters.date,
            time: filters.time,
            guests: filters.guests,
          })
        }
        onFirstPage={() => setFilters({ ...filters, page: 1 })}
        hrefFor={hrefFor}
        timesFor={(restaurant) => (
          <CardTimes slug={restaurant.slug} name={restaurant.name} query={query} today={today} />
        )}
        saveFor={(restaurant) => <RestaurantHeart slug={restaurant.slug} name={restaurant.name} />}
        className="mt-10"
      />
    </PageContainer>
  );
}

/** One card's free times nearest the table looked for: its own request, which its page reuses. */
function CardTimes({
  slug,
  name,
  query,
  today,
}: {
  slug: string;
  name: string;
  query: TableQuery;
  today: string;
}): ReactElement {
  const state = useFreeTimes(slug, query);
  return (
    <FreeTimes
      name={name}
      state={state}
      when={whenWords(query.date, today)}
      linkFor={(time) => freeTimeLink(slug, query, time)}
      pageLink={dayLink(slug, query)}
    />
  );
}
