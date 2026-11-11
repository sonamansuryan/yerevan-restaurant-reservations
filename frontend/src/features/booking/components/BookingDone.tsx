import { useEffect, useRef } from "react";
import type { ReactElement } from "react";

import { Badge } from "@/components/Badge";
import { Button, LinkButton } from "@/components/Button";
import { guestsLabel } from "@/features/booking/booking";
import { ZONE_LABELS } from "@/features/dashboard/labels";
import { formatDayHeading } from "@/lib/time";
import type { GuestReservation } from "@/types/api";

interface BookingDoneProps {
  reservation: GuestReservation;
  guestName: string;
  today: string;
  onBookAnother: () => void;
}

/**
 * The booking, as the small card a restaurant sets on your table: your name, the time and the
 * table. It says only what's true: a new booking waits for the restaurant to confirm it.
 */
export function BookingDone({
  reservation,
  guestName,
  today,
  onBookAnother,
}: BookingDoneProps): ReactElement {
  const heading = useRef<HTMLHeadingElement>(null);
  // The choices it replaces are gone, so keyboards and screen readers start again from here.
  useEffect(() => heading.current?.focus(), []);

  const { date, starts, ends, table, partySize, restaurant } = reservation;
  return (
    <div className="flex flex-col items-start gap-5">
      <h3 ref={heading} tabIndex={-1} className="font-display text-title-xs outline-hidden">
        Booking requested
      </h3>
      <div className="w-full rounded-card border border-line px-6 py-5">
        <Badge tone="warning">Waiting for the restaurant</Badge>
        <p className="mt-3 font-display text-title break-words">{guestName}</p>
        <p className="mt-1 text-ui">
          {formatDayHeading(date, today)}, {starts} to {ends}
        </p>
        <p className="mt-1 text-meta text-ink-muted">
          Table {table.label} · {ZONE_LABELS[table.zone]} · {guestsLabel(partySize)}
        </p>
      </div>
      <p className="text-ui text-ink-secondary">
        {restaurant.name} will confirm it. You’ll find it in My reservations.
      </p>
      <div className="flex flex-wrap gap-x-8 gap-y-2">
        <LinkButton variant="link" to="/reservations">
          My reservations
        </LinkButton>
        <Button variant="link" onClick={onBookAnother}>
          Book another table
        </Button>
      </div>
    </div>
  );
}
