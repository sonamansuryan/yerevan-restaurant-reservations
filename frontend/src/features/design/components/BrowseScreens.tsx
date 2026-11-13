import { useState } from "react";
import type { ReactElement } from "react";
import type { To } from "react-router";

import { Group, Specimens } from "@/features/design/components/parts";
import {
  armenianName,
  dolmamaListing,
  gustavListing,
  highestRated,
  manyCuisines,
  noDescription,
  sampleRestaurants,
} from "@/features/design/samples";
import { screenStates } from "@/features/design/tokens";
import { CardHeart } from "@/features/favorites/components/CardHeart";
import type { BrowseFilters } from "@/features/restaurants/browseFilters";
import { BrowseResults } from "@/features/restaurants/components/BrowseResults";
import { FreeTimes } from "@/features/restaurants/components/FreeTimes";
import { RestaurantCard } from "@/features/restaurants/components/RestaurantCard";
import { RestaurantFilters } from "@/features/restaurants/components/RestaurantFilters";
import { tableQuery } from "@/features/restaurants/tableSearch";
import type { RestaurantSummary } from "@/types/api";

type StateOf<K extends keyof typeof screenStates> = (typeof screenStates)[K][number];

const ignore = (): void => {};
// Pages in these specimens can't be followed, so they all point here.
const stay = (): To => ({ hash: "#screens" });
// A Friday afternoon, so the search starts at 19:30.
const TODAY = "2026-11-13";
const NOW = "16:00";

/** Each card's free times nearest 19:30, as Browse shows them. */
const timesFor = (restaurant: RestaurantSummary): ReactElement => (
  <FreeTimes
    name={restaurant.name}
    state={{ status: "ready", times: ["19:00", "19:30", "20:00"] }}
    when="today"
    linkFor={stay}
    pageLink={stay()}
  />
);

/** Each card's heart, as someone signed out sees it. */
const saveFor = (restaurant: RestaurantSummary): ReactElement => (
  <CardHeart
    name={restaurant.name}
    viewer={{
      kind: "signedOut",
      signIn: { from: { pathname: "/restaurants", search: "", hash: "" } },
    }}
  />
);

// The cards sit under this page's group headings, so their names are one level below.
const actions = {
  onRetry: ignore,
  onClearFilters: ignore,
  onFirstPage: ignore,
  hrefFor: stay,
  cardHeading: "h4",
  timesFor,
  saveFor,
} as const;

/** The filters as they are on Browse, holding their own choices so they can be tried out. */
function LiveFilters(): ReactElement {
  const [filters, setFilters] = useState<BrowseFilters>({ page: 1 });
  return (
    <RestaurantFilters
      key={[filters.q, filters.date, filters.time, filters.guests].join("|")}
      filters={filters}
      onChange={setFilters}
      query={tableQuery(filters, TODAY, NOW)}
      today={TODAY}
    />
  );
}

const filters: Record<StateOf<"browseFilters">, ReactElement> = {
  "Nothing chosen (live)": <LiveFilters />,
  "Search and filters chosen": (
    <RestaurantFilters
      filters={{ q: "wine", cuisine: "ARMENIAN", district: "KENTRON", price: 2, page: 1 }}
      onChange={ignore}
      query={{ date: "2026-11-14", time: "20:00", guests: 4 }}
      today={TODAY}
    />
  ),
  "Highest rated first": (
    <RestaurantFilters
      filters={{ sort: "rating", page: 1 }}
      onChange={ignore}
      query={tableQuery({}, TODAY, NOW)}
      today={TODAY}
    />
  ),
};

const page = (data: typeof sampleRestaurants, total: number, at = 1) => ({
  data,
  meta: { page: at, pageSize: 6, total },
});

const results: Record<StateOf<"browseResults">, ReactElement> = {
  Loading: <BrowseResults filtered={false} {...actions} />,
  "A page of restaurants": (
    <BrowseResults results={page(sampleRestaurants, 9)} filtered={false} {...actions} />
  ),
  "Loading the next list": (
    <BrowseResults
      results={page(sampleRestaurants.slice(0, 3), 3)}
      filtered
      updating
      {...actions}
    />
  ),
  "No matches": <BrowseResults results={page([], 0)} filtered {...actions} />,
  "Nothing yet": <BrowseResults results={page([], 0)} filtered={false} {...actions} />,
  "Couldn’t load": <BrowseResults failed filtered={false} {...actions} />,
  "Past the last page": <BrowseResults results={page([], 9, 5)} filtered={false} {...actions} />,
  "Highest rated first": (
    <BrowseResults results={page(highestRated, 6)} filtered={false} {...actions} />
  ),
};

const cards: Record<StateOf<"restaurantCard">, ReactElement> = {
  "Menu cover": <RestaurantCard restaurant={sampleRestaurants[2] ?? noDescription} heading="h4" />,
  "A long Armenian name": <RestaurantCard restaurant={armenianName} heading="h4" />,
  "Several cuisines": <RestaurantCard restaurant={manyCuisines} heading="h4" />,
  "No description": <RestaurantCard restaurant={noDescription} heading="h4" />,
  "Rated by guests": (
    <RestaurantCard restaurant={sampleRestaurants[2] ?? noDescription} heading="h4" />
  ),
  "Rated by one guest": (
    <RestaurantCard restaurant={sampleRestaurants[5] ?? noDescription} heading="h4" />
  ),
  "A demo listing": <RestaurantCard restaurant={dolmamaListing} heading="h4" />,
  // A square cover a crop would spoil, such as Gustav's with its sign at the top: whole, on the
  // paper tint (covers.ts).
  "A cover shown whole": <RestaurantCard restaurant={gustavListing} heading="h4" coverWhole />,
};

/** Browse, /restaurants, in its states. */
export function BrowseScreens(): ReactElement {
  return (
    <>
      <Group
        title="Browse, the search and filters"
        note="At the top of /restaurants. A choice in a list applies at once. The search applies when it's sent, so the list doesn't reload at every letter. Sort by is by name, or the highest rated first; clearing the filters keeps it."
      >
        <Specimens wide specimens={filters} />
      </Group>
      <Group
        title="Browse, the results"
        note="Under the filters. While a new list loads, the last one stays, dimmed. Nothing found has one way out: clearing the filters."
      >
        <Specimens wide specimens={results} />
      </Group>
      <Group
        title="Restaurant card"
        note="A restaurant with no photo gets a menu cover: its name on one of the photo tones, always the same one. The whole card is one link, named by the restaurant. Once guests have reviewed it, a line says how they rate it."
      >
        <Specimens specimens={cards} />
      </Group>
    </>
  );
}
