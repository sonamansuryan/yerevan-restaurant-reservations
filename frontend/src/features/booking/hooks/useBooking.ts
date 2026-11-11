import { useState } from "react";
import { useLocation, useSearchParams } from "react-router";

import { useMe } from "@/features/auth/hooks/useMe";
import { returnStateFor } from "@/features/auth/returnTo";
import { choicesFrom, choicesParams } from "@/features/booking/booking";
import type { BookingChoices, Viewer } from "@/features/booking/booking";
import type { BookingWidgetProps } from "@/features/booking/components/BookingWidget";
import { useAvailability } from "@/features/booking/hooks/useAvailability";
import { useBookTable } from "@/features/booking/hooks/useBookTable";
import { yerevanToday } from "@/lib/time";

/** The booking widget for one restaurant: its choices, the free tables, and booking one. */
export function useBooking(slug: string): BookingWidgetProps {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  // Read once, when the page opens, so the page doesn't change under someone at midnight.
  const [today] = useState(() => yerevanToday());
  const choices = choicesFrom(params, today);
  const availability = useAvailability(slug, choices.date, choices.guests);
  const booking = useBookTable(slug);
  const me = useMe();

  // Replacing the entry, not adding one, keeps the Back button for leaving the page.
  const keep = (next: BookingChoices): void => setParams(choicesParams(next), { replace: true });

  // A retry clears the error while it runs. Staying on the error keeps Try again in its place.
  const retrying = availability.isFetching && availability.errorUpdateCount > 0;

  // The last answer stands, as in the header: with none, and no way to ask, nobody is signed in.
  const user = me.data === undefined && me.isError ? null : me.data;
  let viewer: Viewer;
  if (user === undefined) viewer = { kind: "checking" };
  else if (user === null) viewer = { kind: "signedOut", signIn: returnStateFor(location) };
  else if (user.role === "CUSTOMER") viewer = { kind: "guest", name: user.name };
  else viewer = { kind: "notAGuest", name: user.name };

  return {
    choices,
    today,
    availability: {
      data: availability.data,
      failed: availability.isError || retrying,
      retrying,
      onRetry: () => void availability.refetch(),
    },
    viewer,
    sending: booking.isPending,
    refusal: booking.error,
    booked: booking.data ?? null,
    onChoose: (change) => {
      booking.reset();
      keep({ ...choices, ...change });
    },
    onBook: (specialRequests) => {
      const { tableId, time } = choices;
      if (!tableId || !time) return;
      booking.mutate(
        {
          tableId,
          time,
          date: choices.date,
          partySize: choices.guests,
          specialRequests: specialRequests || undefined,
        },
        {
          // The table, or the time, can't be booked any more, so it's no longer chosen. The
          // refusal stays on screen, and the free tables have been asked for again.
          onError: (error) => {
            if (error.status === 409 || error.status === 404) keep({ ...choices, tableId: null });
            else if (error.status === 400) keep({ ...choices, time: null, tableId: null });
          },
        },
      );
    },
    onBookAnother: () => {
      booking.reset();
      keep({ ...choices, time: null, tableId: null });
    },
  };
}
