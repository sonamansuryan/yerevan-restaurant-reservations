import { useState } from "react";
import type { ReactElement } from "react";

import {
  atSeven,
  atT2,
  bookingAt,
  loaded,
  saturdayForTwo,
} from "@/features/design/bookingSpecimens";
import { Group, Specimens } from "@/features/design/components/parts";
import { loriSaturday, sampleBooked } from "@/features/design/samples";
import { screenStates } from "@/features/design/tokens";
import { ApiError } from "@/lib/api";
import type { Availability, GuestReservation } from "@/types/api";

type StateOf<K extends keyof typeof screenStates> = (typeof screenStates)[K][number];

const ignore = (): void => {};

const tableTaken = new ApiError(
  409,
  "SLOT_TAKEN",
  "Sorry, this table was just booked for that time. Please choose another time or table.",
);
const noConnection = new ApiError(
  0,
  "NETWORK_ERROR",
  "We can't reach the server right now. Please try again.",
);

// After a refusal the free tables are asked for again, and T2 is gone from 19:00.
const t2Gone: Availability = {
  ...loriSaturday,
  slots: loriSaturday.slots.map((slot) =>
    slot.starts === "19:00"
      ? { ...slot, tables: slot.tables.filter(({ id }) => id !== "table-t2") }
      : slot,
  ),
};

/** Every step works: the choices are kept here, as the page keeps them in its address. */
function LiveBooking(): ReactElement {
  const [choices, setChoices] = useState(saturdayForTwo);
  const [booked, setBooked] = useState<GuestReservation | null>(null);
  return bookingAt({
    choices,
    booked,
    onChoose: (change) => setChoices((current) => ({ ...current, ...change })),
    onBook: () => setBooked(sampleBooked),
    onBookAnother: () => {
      setBooked(null);
      setChoices(saturdayForTwo);
    },
  });
}

const choosing: Record<StateOf<"booking">, ReactElement> = {
  "Choosing (live)": <LiveBooking />,
  "Finding free tables": bookingAt({
    availability: { data: undefined, failed: false, retrying: false, onRetry: ignore },
  }),
  "Couldn’t load the times": bookingAt({
    availability: { data: undefined, failed: true, retrying: false, onRetry: ignore },
  }),
  "No times on this day": bookingAt({ availability: loaded({ ...loriSaturday, slots: [] }) }),
  "Every table taken": bookingAt({
    availability: loaded({
      ...loriSaturday,
      slots: loriSaturday.slots.map((slot) => ({ ...slot, tables: [] })),
    }),
  }),
  "Choosing a table": bookingAt({ choices: atSeven }),
};

const confirming: Record<StateOf<"bookingConfirm">, ReactElement> = {
  "Ready to book": bookingAt({ choices: atT2 }),
  "Signed out": bookingAt({
    choices: atT2,
    viewer: {
      kind: "signedOut",
      signIn: { from: { pathname: "/restaurants/lori-smokehouse", search: "", hash: "" } },
    },
  }),
  "An owner’s account": bookingAt({
    choices: atT2,
    viewer: { kind: "notAGuest", name: "Ani Sargsyan" },
  }),
  Booking: bookingAt({ choices: atT2, sending: true }),
  "The table was just taken": bookingAt({
    choices: atSeven,
    availability: loaded(t2Gone),
    refusal: tableTaken,
  }),
  "Couldn’t book": bookingAt({ choices: atT2, refusal: noConnection }),
  Booked: bookingAt({ booked: sampleBooked }),
};

export function BookingScreens(): ReactElement {
  return (
    <>
      <Group
        title="Booking a table"
        note="Under Book a table on a restaurant’s page. Each step appears once the one before it is chosen, and the address keeps every choice. A time with no free table stays in place, struck through."
      >
        <Specimens specimens={choosing} />
      </Group>
      <Group
        title="Booking it"
        note="The booking is said back before it’s sent. Signed out, the button signs in first and comes back. A table taken meanwhile drops out, with the reason above the tables."
      >
        <Specimens specimens={confirming} />
      </Group>
    </>
  );
}
