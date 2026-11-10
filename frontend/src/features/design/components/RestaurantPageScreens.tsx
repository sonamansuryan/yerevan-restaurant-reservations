import type { ReactElement } from "react";

import { Group, Specimens } from "@/features/design/components/parts";
import { armenianPage, loriPage, reviewedPage, tsiranPage } from "@/features/design/samples";
import { screenStates } from "@/features/design/tokens";
import { RestaurantDetails } from "@/features/restaurants/components/RestaurantDetails";
import {
  RestaurantLoadFailed,
  RestaurantLoading,
} from "@/features/restaurants/components/RestaurantStates";

type StateOf<K extends keyof typeof screenStates> = (typeof screenStates)[K][number];

const ignore = (): void => {};
// Friday, so the late-night line is the one marked Today, whatever day it really is.
const FRIDAY = 5;

const states: Record<StateOf<"restaurantPage">, ReactElement> = {
  "Late nights and a closed day": (
    <RestaurantDetails restaurant={tsiranPage} today={FRIDAY} headingLevel={4} />
  ),
  "Split shifts, no description": (
    <RestaurantDetails restaurant={loriPage} today={FRIDAY} headingLevel={4} />
  ),
  "A long Armenian name, with a website": (
    <RestaurantDetails restaurant={armenianPage} today={FRIDAY} headingLevel={4} />
  ),
  "With reviews": <RestaurantDetails restaurant={reviewedPage} today={FRIDAY} headingLevel={4} />,
  Loading: (
    <div className="flex min-h-40 items-center justify-center">
      <RestaurantLoading />
    </div>
  ),
  "Couldn’t load": (
    <div className="flex flex-col items-center">
      <RestaurantLoadFailed onRetry={ignore} retrying={false} />
    </div>
  ),
};

/** A restaurant's page, /restaurants/:slug, in its states. */
export function RestaurantPageScreens(): ReactElement {
  return (
    <Group
      title="Restaurant page"
      note="With no photo, the cover is the title itself, on the restaurant's tone. Opening hours are menu lines, Monday first, with today marked: Friday here. A restaurant that doesn't exist gets the not-found page: see it under Responsive."
    >
      <Specimens wide specimens={states} />
    </Group>
  );
}
