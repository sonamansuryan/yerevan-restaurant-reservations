import type { ReactElement } from "react";

import { districts } from "@/components/site-links";
import { Group, Specimens } from "@/features/design/components/parts";
import { dolmamaListing, gustavListing, sampleRestaurants } from "@/features/design/samples";
import { screenStates } from "@/features/design/tokens";
import { CardHeart } from "@/features/favorites/components/CardHeart";
import { HomeHero } from "@/features/home/components/HomeHero";
import { Neighborhoods } from "@/features/home/components/Neighborhoods";
import { OwnersBand } from "@/features/home/components/OwnersBand";
import { TonightTimes } from "@/features/home/components/TonightTimes";
import type { TonightState } from "@/features/home/home";
import { FeaturedRestaurants } from "@/features/restaurants/components/FeaturedRestaurants";
import type { ListResponse, RestaurantSummary } from "@/types/api";

type StateOf<K extends keyof typeof screenStates> = (typeof screenStates)[K][number];

const ignore = (): void => {};
// Samples, as everywhere on this page: the real page asks the API for tonight's times.
const DATE = "2026-11-13";
const list = (data: RestaurantSummary[]): ListResponse<RestaurantSummary> => ({
  data,
  meta: { page: 1, pageSize: 3, total: data.length === 0 ? 0 : 16 },
});
const three = list([gustavListing, dolmamaListing, sampleRestaurants[2] ?? dolmamaListing]);
const one = list([dolmamaListing]);
const timesAre =
  (state: TonightState) =>
  (restaurant: RestaurantSummary): ReactElement => (
    <TonightTimes slug={restaurant.slug} name={restaurant.name} date={DATE} state={state} />
  );
const areas = (counts: (number | undefined)[]): Parameters<typeof Neighborhoods>[0]["areas"] =>
  districts.map((area, index) => ({ to: area.to, label: area.label, count: counts[index] }));

// The cards sit under this page's group headings, so their names are one level below.
const states: Record<StateOf<"home">, ReactElement> = {
  // Not live: a search, or a cuisine, would leave this page for Browse.
  "The opening, with the search": (
    <HomeHero
      total={16}
      query={{ date: DATE, time: "19:30", guests: 2 }}
      today={DATE}
      heading="h4"
    />
  ),
  "Available tonight": (
    <FeaturedRestaurants
      results={three}
      onRetry={ignore}
      cardHeading="h4"
      timesFor={timesAre({ status: "ready", times: ["19:00", "19:30", "20:00"] })}
      saveFor={(restaurant) => (
        <CardHeart
          name={restaurant.name}
          viewer={
            restaurant.slug === "dolmama"
              ? { kind: "guest", saved: true, saving: false, error: null, onToggle: ignore }
              : { kind: "guest", saved: false, saving: false, error: null, onToggle: ignore }
          }
        />
      )}
    />
  ),
  "Tonight’s times loading": (
    <FeaturedRestaurants
      results={one}
      onRetry={ignore}
      cardHeading="h4"
      timesFor={timesAre({ status: "loading" })}
    />
  ),
  "No tables free tonight": (
    <FeaturedRestaurants
      results={one}
      onRetry={ignore}
      cardHeading="h4"
      timesFor={timesAre({ status: "ready", times: [] })}
    />
  ),
  "Tonight’s times didn’t load": (
    <FeaturedRestaurants
      results={one}
      onRetry={ignore}
      cardHeading="h4"
      timesFor={timesAre({ status: "failed" })}
    />
  ),
  "Explore by neighborhood": <Neighborhoods areas={areas([13, 1, 1, 1])} />,
  "Neighborhoods, still counting": <Neighborhoods areas={areas([])} />,
  "For restaurant owners": <OwnersBand heading="h4" />,
  Loading: <FeaturedRestaurants onRetry={ignore} />,
  "Nothing yet": <FeaturedRestaurants results={list([])} onRetry={ignore} />,
  "Couldn’t load": <FeaturedRestaurants failed onRetry={ignore} />,
};

/** The home page, /: the dark opening, tonight's restaurants, the districts and the owners' band. */
export function HomeScreens(): ReactElement {
  return (
    <Group
      title="Home"
      note="The dark opening holds the search for a table: the words, the day, the time and the party go to Browse, where each restaurant shows its free times nearest then. Cuisines to browse follow. Then two rows of restaurants, each with a heart to save it and tonight’s first free times for two: a time opens the restaurant with the booking already at it. The districts open Browse filtered to them, and the owners’ band shows only to someone signed out. See the whole page under Responsive."
    >
      <Specimens wide specimens={states} />
    </Group>
  );
}
