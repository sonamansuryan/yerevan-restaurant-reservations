import type { ReactElement } from "react";

import { bookingLink } from "@/features/home/home";
import type { TonightState } from "@/features/home/home";
import { FreeTimes } from "@/features/restaurants/components/FreeTimes";

interface TonightTimesProps {
  slug: string;
  /** The restaurant's name, which each time's spoken label includes. */
  name: string;
  /** Yerevan's today, as YYYY-MM-DD. */
  date: string;
  state: TonightState;
}

/**
 * Tonight's first free times at a restaurant, for two, on its home page card. Each opens the
 * restaurant's page with the booking already at that time. With none left tonight, or none loaded,
 * a link to all its times takes their place.
 */
export function TonightTimes({ slug, name, date, state }: TonightTimesProps): ReactElement {
  return (
    <FreeTimes
      name={name}
      state={state}
      when="tonight"
      linkFor={(starts) => bookingLink(slug, date, starts)}
      pageLink={`/restaurants/${slug}`}
    />
  );
}
