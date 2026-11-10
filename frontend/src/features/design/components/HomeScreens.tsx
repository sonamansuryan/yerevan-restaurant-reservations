import type { ReactElement } from "react";

import { Group, Specimens } from "@/features/design/components/parts";
import { sampleRestaurants } from "@/features/design/samples";
import { screenStates } from "@/features/design/tokens";
import { EveningOverYerevan } from "@/features/home/components/EveningOverYerevan";
import { FeaturedRestaurants } from "@/features/restaurants/components/FeaturedRestaurants";
import { RestaurantSearch } from "@/features/restaurants/components/RestaurantSearch";

type StateOf<K extends keyof typeof screenStates> = (typeof screenStates)[K][number];

const ignore = (): void => {};
const few = { data: sampleRestaurants.slice(0, 3), meta: { page: 1, pageSize: 3, total: 6 } };
const none = { data: [], meta: { page: 1, pageSize: 3, total: 0 } };

// The cards sit under this page's group headings, so their names are one level below.
const states: Record<StateOf<"home">, ReactElement> = {
  // Its evening plays when it scrolls into view, unless the device asks for less motion.
  "Evening over Yerevan, beside the headline": <EveningOverYerevan className="max-w-80" />,
  // Not live: sending it would leave this page for Browse.
  "The search": <RestaurantSearch />,
  "A few places to start": <FeaturedRestaurants results={few} onRetry={ignore} cardHeading="h4" />,
  Loading: <FeaturedRestaurants onRetry={ignore} />,
  "Nothing yet": <FeaturedRestaurants results={none} onRetry={ignore} />,
  "Couldn’t load": <FeaturedRestaurants failed onRetry={ignore} />,
};

/** The home page, /, under its headline: the search, then a few restaurants, in their states. */
export function HomeScreens(): ReactElement {
  return (
    <Group
      title="Home"
      note="Under “Choose your Seghan.”: the search takes the words to Browse, then three restaurants with a link to all of them. See the whole page under Responsive."
    >
      <Specimens wide specimens={states} />
    </Group>
  );
}
