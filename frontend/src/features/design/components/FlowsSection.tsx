import type { ReactElement } from "react";

import { BookingChangeNotice } from "@/features/dashboard/components/BookingChangeNotice";
import { DayBookings } from "@/features/dashboard/components/DayBookings";
import { atSeven, atT2, bookingAt } from "@/features/design/bookingSpecimens";
import { Group, Section } from "@/features/design/components/parts";
import { loriSmokehouse, sampleBooked } from "@/features/design/samples";
import { GuestBookings } from "@/features/reservations/components/GuestBookings";
import { RestaurantCard } from "@/features/restaurants/components/RestaurantCard";
import type { GuestReservation, OwnerReservation } from "@/types/api";

const ignore = (): void => {};
// Wednesday 11 November 2026, as on the booking widget's samples.
const TODAY = "2026-11-11";

// The new booking, as Lori Smokehouse's owner sees it in the day's bookings.
const inTheOwnersDay: OwnerReservation = {
  id: sampleBooked.id,
  status: "PENDING",
  partySize: sampleBooked.partySize,
  startsAt: sampleBooked.startsAt,
  endsAt: sampleBooked.endsAt,
  starts: sampleBooked.starts,
  ends: sampleBooked.ends,
  table: { id: "table-t2", label: "T2", zone: "INDOOR" },
  guest: { name: "Lilit Harutyunyan" },
  specialRequests: null,
  cancellation: null,
  actions: ["CONFIRMED", "CANCELLED"],
};

/** The same booking, moved on. Each step offers what the server would allow then. */
const ownersBooking = (change: Partial<OwnerReservation>): OwnerReservation => ({
  ...inTheOwnersDay,
  ...change,
});
const confirmed = ownersBooking({ status: "CONFIRMED", actions: ["CANCELLED"] });
const atTheDoor = ownersBooking({ status: "CONFIRMED", actions: ["ARRIVED", "CANCELLED"] });
const arrived = ownersBooking({ status: "ARRIVED", actions: [] });
const started = ownersBooking({
  status: "CONFIRMED",
  actions: ["ARRIVED", "NO_SHOW", "CANCELLED"],
});

/** The guest's side of the same booking, in My reservations. */
const guestsBooking = (change: Partial<GuestReservation>): GuestReservation => ({
  ...sampleBooked,
  ...change,
});

/** The restaurant's day: what the last change did, then the booking with the changes it allows. */
function OwnersDay({
  booking,
  changed = null,
}: {
  booking: OwnerReservation;
  changed?: OwnerReservation | null;
}): ReactElement {
  return (
    <div>
      <BookingChangeNotice changed={changed} refusal={null} className="mb-6" />
      <DayBookings reservations={[booking]} onChange={ignore} />
    </div>
  );
}

const handleAReservation: { step: string; screen: ReactElement }[] = [
  {
    step: "A new booking waits in the restaurant's day",
    screen: <OwnersDay booking={inTheOwnersDay} />,
  },
  {
    step: "The restaurant confirms it",
    screen: <OwnersDay booking={confirmed} changed={confirmed} />,
  },
  {
    step: "The guest sees it confirmed in My reservations",
    screen: (
      <GuestBookings
        reservations={[guestsBooking({ status: "CONFIRMED" })]}
        today={TODAY}
        onCancel={ignore}
        headingLevel={4}
      />
    ),
  },
  {
    step: "From 30 minutes before, the guest can be marked arrived",
    screen: <OwnersDay booking={atTheDoor} />,
  },
  { step: "The guest arrives", screen: <OwnersDay booking={arrived} changed={arrived} /> },
  {
    step: "Or, once it has started, a guest who didn't come is marked a no-show",
    screen: <OwnersDay booking={started} />,
  },
  {
    step: "Or the restaurant cancels it, and the guest sees why",
    screen: (
      <GuestBookings
        reservations={[
          guestsBooking({
            status: "CANCELLED",
            canCancel: false,
            cancellation: {
              by: "RESTAURANT",
              reason: "We’re closed for a private event that night.",
            },
          }),
        ]}
        today={TODAY}
        headingLevel={4}
      />
    ),
  },
];

const bookATable: { step: string; screen: ReactElement }[] = [
  {
    step: "Find a restaurant on Browse",
    screen: <RestaurantCard restaurant={loriSmokehouse} heading="h4" />,
  },
  { step: "Choose the date and the party, and see the times", screen: bookingAt() },
  { step: "Choose a time, and see the free tables", screen: bookingAt({ choices: atSeven }) },
  { step: "Choose a table, and hear the booking said back", screen: bookingAt({ choices: atT2 }) },
  { step: "Book it, and wait for the restaurant", screen: bookingAt({ booked: sampleBooked }) },
  {
    step: "The restaurant sees it in its day",
    screen: <DayBookings reservations={[inTheOwnersDay]} />,
  },
];

/** A journey's steps, numbered, each a moment that can't be clicked or reached with Tab. */
function Journey({ steps }: { steps: { step: string; screen: ReactElement }[] }): ReactElement {
  return (
    <ol className="grid gap-x-16 gap-y-12 xl:grid-cols-2">
      {steps.map(({ step, screen }, index) => (
        <li key={step} className="flex max-w-105 min-w-0 flex-col gap-4">
          <p className="text-caption text-ink-muted">
            {index + 1}. {step}
          </p>
          <div inert>{screen}</div>
        </li>
      ))}
    </ol>
  );
}

/** Whole journeys, screen after screen, made from the same real components. */
export function FlowsSection(): ReactElement {
  return (
    <Section
      id="flows"
      title="Flows"
      intro="Whole journeys, one screen after another, in the order people meet them."
    >
      <Group
        title="Book a table"
        note="The assignment’s final result: find a restaurant, choose the date, time and guests, see the free tables, book one, and the restaurant receives it."
      >
        <Journey steps={bookATable} />
      </Group>
      <Group
        title="Handle a reservation"
        note="The restaurant’s side, on its dashboard: confirm a new booking, mark the guest arrived from 30 minutes before, or a no-show once it has started, or cancel it with a reason the guest sees. Each booking offers only the changes allowed then, a no-show and a cancellation ask first, and the day is asked for again every 30 seconds."
      >
        <Journey steps={handleAReservation} />
      </Group>
    </Section>
  );
}
