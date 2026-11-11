import type { ReactElement } from "react";

import { Badge } from "@/components/Badge";
import {
  STATUS_LABELS,
  STATUS_TONES,
  ZONE_LABELS,
  cancellationWords,
  guestsWords,
} from "@/features/dashboard/labels";
import { tableName } from "@/features/dashboard/tables";
import { cx } from "@/lib/cx";
import type { OwnerReservation } from "@/types/api";

function BookingLine({ reservation }: { reservation: OwnerReservation }): ReactElement {
  const { status, starts, ends, guest, table, partySize, specialRequests, cancellation } =
    reservation;
  // Struck through, like a line crossed out in the book. The badge says it in words.
  const crossedOut = status === "CANCELLED" && "text-ink-muted line-through";
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 gap-y-1 border-b border-line py-4 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto]">
      <p className={cx("text-ui font-medium tabular-nums", crossedOut)}>
        <span aria-hidden="true">
          {starts}–{ends}
        </span>
        <span className="sr-only">
          {starts} to {ends}
        </span>
      </p>
      <div className="justify-self-end sm:order-last">
        <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>
      </div>
      <div className="col-span-2 min-w-0 sm:col-span-1">
        <p className={cx("font-display text-title-xs break-words", crossedOut)}>{guest.name}</p>
        <p className="mt-0.5 text-meta text-ink-secondary">
          {tableName(table.label)} · {ZONE_LABELS[table.zone]} · {guestsWords(partySize)}
        </p>
        {specialRequests && (
          <p className="mt-2 text-meta break-words text-ink-secondary">
            <span className="font-medium text-ink">Note:</span> {specialRequests}
          </p>
        )}
        {cancellation && (
          <p className="mt-2 text-meta break-words text-ink-secondary">
            {cancellationWords(cancellation)}
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * A day's page in the reservation book: one ruled line per booking, by time and then table. A
 * cancelled booking stays on the page, crossed out, as it would in a real book.
 */
export function DayBookings({ reservations }: { reservations: OwnerReservation[] }): ReactElement {
  return (
    <ul className="border-t border-line">
      {reservations.map((reservation) => (
        <BookingLine key={reservation.id} reservation={reservation} />
      ))}
    </ul>
  );
}
