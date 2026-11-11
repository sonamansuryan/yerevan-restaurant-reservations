import type { ReactElement } from "react";

import { DayBookings } from "@/features/dashboard/components/DayBookings";
import { atSeven, atT2, bookingAt } from "@/features/design/bookingSpecimens";
import { Group, Section } from "@/features/design/components/parts";
import { loriSmokehouse, sampleBooked } from "@/features/design/samples";
import { RestaurantCard } from "@/features/restaurants/components/RestaurantCard";

// The new booking, as Lori Smokehouse's owner sees it in the day's bookings.
const inTheOwnersDay = {
  ...sampleBooked,
  table: { id: "table-t2", label: "T2", zone: "INDOOR" },
  guest: { name: "Lilit Harutyunyan" },
  cancellation: null,
} as const;

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
        <ol className="grid gap-x-16 gap-y-12 xl:grid-cols-2">
          {bookATable.map(({ step, screen }, index) => (
            <li key={step} className="flex max-w-105 min-w-0 flex-col gap-4">
              <p className="text-caption text-ink-muted">
                {index + 1}. {step}
              </p>
              {/* Each stands for one moment, so it can't be clicked or reached with Tab. */}
              <div inert>{screen}</div>
            </li>
          ))}
        </ol>
      </Group>
    </Section>
  );
}
