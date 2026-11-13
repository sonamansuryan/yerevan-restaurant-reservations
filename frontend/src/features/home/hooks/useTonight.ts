import { useState } from "react";

import { useAvailability } from "@/features/booking/hooks/useAvailability";
import { TONIGHT_GUESTS, tonightTimes } from "@/features/home/home";
import type { TonightState } from "@/features/home/home";
import { yerevanToday } from "@/lib/time";

/**
 * Tonight's first free times at one restaurant, for its card on the home page: Yerevan's today, for
 * two. It's the same request the restaurant's page makes for today and two guests, so opening the
 * page afterwards shows its times at once.
 */
export function useTonight(slug: string): { date: string; state: TonightState } {
  // Read once, when the card first shows: a card has to render the same way each time.
  const [date] = useState(() => yerevanToday());
  const availability = useAvailability(slug, date, TONIGHT_GUESTS);

  if (availability.data) {
    return { date, state: { status: "ready", times: tonightTimes(availability.data) } };
  }
  if (availability.isError) return { date, state: { status: "failed" } };
  return { date, state: { status: "loading" } };
}
