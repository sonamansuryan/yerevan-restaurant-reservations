import type { ReactElement } from "react";

import { atSeven, bookingAt } from "@/features/design/bookingSpecimens";
import { Group, Specimens } from "@/features/design/components/parts";
import {
  armenianPage,
  dolmamaPage,
  gustavPage,
  kamanchaPage,
  loriPage,
  mayrigPage,
  reviewedPage,
  sampleReviews,
  sherepPage,
  tsiranPage,
  yasamanPage,
} from "@/features/design/samples";
import { screenStates } from "@/features/design/tokens";
import { RestaurantDetails } from "@/features/restaurants/components/RestaurantDetails";
import { RestaurantMap } from "@/features/restaurants/components/RestaurantMap";
import {
  RestaurantLoadFailed,
  RestaurantLoading,
} from "@/features/restaurants/components/RestaurantStates";

type StateOf<K extends keyof typeof screenStates> = (typeof screenStates)[K][number];

const ignore = (): void => {};
// Friday, so the late-night line is the one marked Today, whatever day it really is.
const FRIDAY = 5;

/**
 * Lori's page with its map in one state. The live one asks the running API for Lori's real map, so
 * it shows once GEOAPIFY_API_KEY is in backend/.env, and looks like no map until then.
 */
function withMap(hold?: "loading" | "unavailable"): ReactElement {
  const src = "/api/restaurants/lori-smokehouse/map";
  return (
    <RestaurantDetails
      restaurant={loriPage}
      today={FRIDAY}
      headingLevel={4}
      map={<RestaurantMap src={src} mapsUrl={loriPage.mapsUrl} hold={hold} className="mt-4" />}
    />
  );
}

const states: Record<StateOf<"restaurantPage">, ReactElement> = {
  "Late nights and a closed day": (
    <RestaurantDetails restaurant={tsiranPage} today={FRIDAY} headingLevel={4} />
  ),
  "Split shifts, no description": (
    <RestaurantDetails
      restaurant={loriPage}
      today={FRIDAY}
      headingLevel={4}
      booking={bookingAt({ choices: atSeven })}
    />
  ),
  "A long Armenian name, with a website": (
    <RestaurantDetails restaurant={armenianPage} today={FRIDAY} headingLevel={4} />
  ),
  "With reviews": (
    <RestaurantDetails
      restaurant={reviewedPage}
      today={FRIDAY}
      headingLevel={4}
      reviews={{
        reviews: sampleReviews,
        failed: false,
        retrying: false,
        onRetry: ignore,
        hasMore: true,
        loadingMore: false,
        moreFailed: false,
        onMore: ignore,
      }}
    />
  ),
  "With a map (live)": withMap(),
  "The map loading": withMap("loading"),
  "No map: none set up, or it couldn’t load": withMap("unavailable"),
  // One line before the booking says it's a test booking. Under the cover, its photos' credits,
  // then its details' (OpenStreetMap, through Geoapify), in small print.
  "A demo listing, its photos credited": (
    <RestaurantDetails
      restaurant={dolmamaPage}
      today={FRIDAY}
      headingLevel={4}
      booking={bookingAt({ choices: atSeven })}
    />
  ),
  "A demo listing with no photo": (
    <RestaurantDetails restaurant={mayrigPage} today={FRIDAY} headingLevel={4} />
  ),
  // No cuisine, hours, photo or contact in any source: each part says so or stays out.
  "A demo listing with details missing": (
    <RestaurantDetails restaurant={kamanchaPage} today={FRIDAY} headingLevel={4} />
  ),
  // Its restaurant group's site credited once for its four photos, then Commons for the fifth.
  "A demo listing, its photos from its own site": (
    <RestaurantDetails restaurant={sherepPage} today={FRIDAY} headingLevel={4} />
  ),
  // Details from public listings alone, so no credit: only OpenStreetMap's license asks for one.
  "A demo listing not in OpenStreetMap": (
    <RestaurantDetails restaurant={yasamanPage} today={FRIDAY} headingLevel={4} />
  ),
  // A square cover a crop would spoil, such as Gustav's with its sign at the top: whole, on the
  // paper tint, with space at its sides (covers.ts).
  "A cover shown whole": (
    <RestaurantDetails restaurant={gustavPage} today={FRIDAY} headingLevel={4} coverWhole />
  ),
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
      note="With no photo, the cover is the title itself, on the restaurant's tone. Opening hours are menu lines, Monday first, with today marked: Friday here. A restaurant that doesn't exist gets the not-found page: see it under Responsive. The map sits above the address: OpenStreetMap's streets in Geoapify's light Positron style, with the logo's wine dot at the place, and it opens Google Maps. The live one shows the real picture once GEOAPIFY_API_KEY is in backend/.env; with no key, or when the address can't be found or Geoapify fails, there's no map, and the address and its link stand alone, as before."
    >
      <Specimens wide specimens={states} />
    </Group>
  );
}
