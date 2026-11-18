// The home page's rules that need no server: which of a restaurant's times count as tonight's,
// the link each one opens, and the cuisines it offers to browse.
import type { To } from "react-router";

import { choicesParams } from "@/features/booking/booking";
import type { FreeTimesState } from "@/features/restaurants/components/FreeTimes";
import type { Availability, Cuisine } from "@/types/api";

/** The party the home page asks about: "Available tonight for 2". */
export const TONIGHT_GUESTS = 2;

/** How many times a card offers, so they fit on one line. */
export const TONIGHT_TIMES = 3;

/** Tonight starts here. Earlier times are lunch. */
export const EVENING_FROM = "18:00";

/** A card's times for tonight: still loading, couldn't load, or the times, which may be none. */
export type TonightState = FreeTimesState;

/**
 * The evening's first free times: from 18:00, with a table for the party. The API has already left
 * out the times that are past or less than an hour away.
 */
export function tonightTimes(availability: Availability): string[] {
  return availability.slots
    .filter(({ starts, tables }) => tables.length > 0 && starts >= EVENING_FROM)
    .slice(0, TONIGHT_TIMES)
    .map(({ starts }) => starts);
}

/**
 * The restaurant's page with the booking already at this time, for two. The booking widget reads
 * the same choices from the address, so the guest lands on choosing a table.
 */
export function bookingLink(slug: string, date: string, time: string): To {
  const choices = choicesParams({ date, guests: TONIGHT_GUESTS, time, tableId: null });
  return { pathname: `/restaurants/${slug}`, search: `?${choices.toString()}` };
}

/**
 * The cuisines the home page offers to browse: the ones with restaurants on Seghan, most first, so
 * none leads to an empty list. Revisit when the restaurants change.
 */
export const HOME_CUISINES: Cuisine[] = [
  "ARMENIAN",
  "EUROPEAN",
  "FUSION",
  "GEORGIAN",
  "MIDDLE_EASTERN",
  "SEAFOOD",
  "STEAKHOUSE",
];

/** How many restaurants the home page shows: two rows of four on a laptop, as in the export. */
export const HOME_COUNT = 8;

/**
 * How many restaurants the home page asks the list for: twice what it shows, so the ones it leaves
 * out (shownOnHome) still leave enough to fill both rows.
 */
export const HOME_LIST_SIZE = HOME_COUNT * 2;

/** What the home page needs to know about a restaurant to choose it. */
interface HomeCandidate {
  slug: string;
  isDemoListing: boolean;
  coverPhotoUrl: string | null;
}

/**
 * Whether the home page shows a restaurant: every one but a real place listed for the demo (9.7)
 * with no photo, whose card would show only its name on a colored cover. Browse and search still
 * list them. In the public demo, those are Dolmama, Gustav, Lavash and PAUL: their only photos came
 * from their own sites, which it leaves out (10.1).
 */
export function shownOnHome({ isDemoListing, coverPhotoUrl }: HomeCandidate): boolean {
  return !(isDemoListing && coverPhotoUrl === null);
}

/**
 * The home page's restaurants: the ones Seghan features, in their order, then others from the list
 * that aren't among them, up to HOME_COUNT, leaving out those it doesn't show (shownOnHome).
 */
export function homeRestaurants<Restaurant extends HomeCandidate>(
  featured: readonly Restaurant[],
  others: readonly Restaurant[],
): Restaurant[] {
  const chosen = featured.filter(shownOnHome);
  const more = others.filter(
    (one) => shownOnHome(one) && !featured.some(({ slug }) => slug === one.slug),
  );
  return [...chosen, ...more].slice(0, HOME_COUNT);
}

/** "1 restaurant", "13 restaurants". */
export function restaurantsWords(count: number): string {
  return count === 1 ? "1 restaurant" : `${count} restaurants`;
}
