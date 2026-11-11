import { useState } from "react";
import type { ReactElement } from "react";
import type { To } from "react-router";

import { Group, Specimens } from "@/features/design/components/parts";
import { guestPast, guestUpcoming } from "@/features/design/samples";
import type { screenStates } from "@/features/design/tokens";
import { MyReservations } from "@/features/reservations/components/MyReservations";
import type {
  MyReservationsProps,
  ReservationListState,
} from "@/features/reservations/components/MyReservations";
import type { ReservationsWhen } from "@/features/reservations/reservations";
import { ApiError } from "@/lib/api";
import type { GuestReservation } from "@/types/api";

type StateOf<K extends keyof typeof screenStates> = (typeof screenStates)[K][number];

// Wednesday 11 November 2026, as on the booking widget's samples.
const TODAY = "2026-11-11";
const ignore = (): void => {};

/** A list that has come: these bookings, as page `at` of `total`. */
function loaded(data: GuestReservation[], total = data.length, at = 1): ReservationListState {
  return {
    data: { data, meta: { page: at, pageSize: 20, total } },
    failed: false,
    retrying: false,
    onRetry: ignore,
  };
}

/**
 * The open list links to /design itself, so the nav marks it as the one you're on. The other
 * list's link goes nowhere here, as these specimens can't be clicked.
 */
const marking =
  (open: ReservationsWhen) =>
  (when: ReservationsWhen): To =>
    when === open ? "/design" : `/design/${when}`;

/** My reservations on one list, as the page shows it, with anything changed for a state. */
function screen(when: ReservationsWhen, change: Partial<MyReservationsProps> = {}): ReactElement {
  return (
    <MyReservations
      when={when}
      page={1}
      today={TODAY}
      list={loaded(when === "upcoming" ? guestUpcoming : guestPast)}
      hrefFor={marking(when)}
      cancellingId={null}
      cancelled={null}
      refusal={null}
      onCancel={ignore}
      onFindATable={ignore}
      onFirstPage={ignore}
      headingLevel={4}
      {...change}
    />
  );
}

const cancelledByYou = (booking: GuestReservation): GuestReservation => ({
  ...booking,
  status: "CANCELLED",
  cancellation: { by: "CUSTOMER", reason: null },
  canCancel: false,
});

/**
 * The live one asks first, as the page does, then crosses the booking out here instead of sending
 * anything. Past goes to the real page.
 */
function LiveUpcoming(): ReactElement {
  const [bookings, setBookings] = useState(guestUpcoming);
  const [cancelled, setCancelled] = useState<GuestReservation | null>(null);

  function cancel(booking: GuestReservation): void {
    const done = cancelledByYou(booking);
    setBookings((all) => all.map((one) => (one.id === booking.id ? done : one)));
    setCancelled(done);
  }

  return screen("upcoming", {
    list: loaded(bookings),
    cancelled,
    onCancel: cancel,
    hrefFor: (when) => (when === "upcoming" ? "/design" : "/reservations/past"),
  });
}

const lori = guestUpcoming.find(({ id }) => id === "upcoming-lori") ?? guestUpcoming[0]!;
const loriCancelled = cancelledByYou(lori);
const tooLate = new ApiError(
  409,
  "CANCEL_TOO_LATE",
  "This booking has already started, so it can’t be cancelled.",
);
const noConnection = new ApiError(
  0,
  "NETWORK_ERROR",
  "We can't reach the server right now. Please try again.",
);

const myReservations: Record<StateOf<"myReservations">, ReactElement> = {
  "Upcoming (live)": <LiveUpcoming />,
  "Past, over several pages": screen("past", { list: loaded(guestPast, 24) }),
  Cancelling: screen("upcoming", { cancellingId: lori.id }),
  Cancelled: screen("upcoming", {
    list: loaded(guestUpcoming.map((one) => (one.id === lori.id ? loriCancelled : one))),
    cancelled: loriCancelled,
  }),
  "Too late to cancel": screen("upcoming", { refusal: tooLate }),
  "Couldn’t cancel": screen("upcoming", { refusal: noConnection }),
  "No upcoming bookings": screen("upcoming", { list: loaded([]) }),
  "No past bookings": screen("past", { list: loaded([]) }),
  Loading: screen("upcoming", {
    list: { data: undefined, failed: false, retrying: false, onRetry: ignore },
  }),
  "Couldn’t load": screen("upcoming", {
    list: { data: undefined, failed: true, retrying: false, onRetry: ignore },
  }),
  "Past the last page": screen("past", { page: 3, list: loaded([], 24, 3) }),
};

/** A guest's own bookings, /reservations and /reservations/past, in their states. */
export function ReservationsScreens(): ReactElement {
  return (
    <Group
      title="My reservations"
      note="For guests only; an owner is told the page is for guests (see the route guard's states). Upcoming bookings aren't over yet, soonest first, and past ones are, latest first. Each day is under its name, and each booking is a ruled line, as in the restaurant's book. A cancelled booking stays, crossed out, with who cancelled it and why. Cancel booking asks first: in the live one, the question opens over the page, and confirming crosses the booking out here without sending anything."
    >
      <Specimens wide specimens={myReservations} />
    </Group>
  );
}
