import { useState } from "react";
import type { ReactElement } from "react";

import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { CHANGE_LABELS, CHANGE_ORDER } from "@/features/dashboard/bookingChanges";
import type { BookingChange } from "@/features/dashboard/bookingChanges";
import { CancelBookingForm } from "@/features/dashboard/components/CancelBookingForm";
import {
  STATUS_LABELS,
  STATUS_TONES,
  ZONE_LABELS,
  cancellationWords,
  guestsWords,
} from "@/features/dashboard/labels";
import { tableName } from "@/features/dashboard/tables";
import { cx } from "@/lib/cx";
import type { OwnerReservation, RestaurantChange } from "@/types/api";

/** The change being sent: which booking, and to what. */
export interface ChangeInFlight {
  id: string;
  status: RestaurantChange;
}

interface BookingLineProps {
  reservation: OwnerReservation;
  /** Asks for a change. Without it, the line is only read. */
  onAct?: (reservation: OwnerReservation, change: RestaurantChange) => void;
  changing: ChangeInFlight | null;
}

function BookingLine({ reservation, onAct, changing }: BookingLineProps): ReactElement {
  const { id, status, starts, ends, guest, table, partySize, specialRequests, cancellation } =
    reservation;
  // Struck through, like a line crossed out in the book. The badge says it in words.
  const crossedOut = status === "CANCELLED" && "text-ink-muted line-through";
  // Only the changes the server allows now, the usual next step first.
  const actions = CHANGE_ORDER.filter((change) => reservation.actions.includes(change));
  const sending = changing?.id === id ? changing.status : null;
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
        {onAct && actions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-x-6">
            {actions.map((change) => (
              <Button
                key={change}
                variant="link"
                aria-label={`${CHANGE_LABELS[change]}, ${guest.name}, ${starts}`}
                loading={sending === change}
                // One change at a time for a booking: the others wait for the answer.
                disabled={sending !== null && sending !== change}
                onClick={() => onAct(reservation, change)}
              >
                {CHANGE_LABELS[change]}
              </Button>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

interface DayBookingsProps {
  reservations: OwnerReservation[];
  /** Sends a change to a booking. Without it, the day is only read. */
  onChange?: (reservation: OwnerReservation, change: BookingChange) => void;
  /** The change being sent, whose button waits. */
  changing?: ChangeInFlight | null;
}

/**
 * A day's page in the reservation book: one ruled line per booking, by time and then table. A
 * cancelled booking stays on the page, crossed out, as it would in a real book.
 *
 * Each booking offers the changes the server allows now. Confirming and marking a guest arrived
 * happen at once. Cancelling and marking a no-show ask first, because a no-show can't be undone
 * and a cancelled table may be booked straight away.
 */
export function DayBookings({
  reservations,
  onChange,
  changing = null,
}: DayBookingsProps): ReactElement {
  const [asking, setAsking] = useState<{
    reservation: OwnerReservation;
    change: "CANCELLED" | "NO_SHOW";
  } | null>(null);

  function act(reservation: OwnerReservation, change: RestaurantChange): void {
    if (change === "CANCELLED" || change === "NO_SHOW") setAsking({ reservation, change });
    else onChange?.(reservation, { status: change });
  }

  function send(change: BookingChange): void {
    if (asking) onChange?.(asking.reservation, change);
    setAsking(null);
  }

  return (
    <>
      <ul className="border-t border-line">
        {reservations.map((reservation) => (
          <BookingLine
            key={reservation.id}
            reservation={reservation}
            onAct={onChange ? act : undefined}
            changing={changing}
          />
        ))}
      </ul>

      {onChange && (
        <>
          <Modal
            open={asking?.change === "NO_SHOW"}
            onClose={() => setAsking(null)}
            title="Mark as a no-show?"
            footer={
              <>
                <Button variant="ghost" onClick={() => setAsking(null)}>
                  Keep it
                </Button>
                <Button onClick={() => send({ status: "NO_SHOW" })}>Mark no-show</Button>
              </>
            }
          >
            {asking?.change === "NO_SHOW" &&
              `${asking.reservation.guest.name} didn’t come for their table at ${asking.reservation.starts}. This can’t be undone.`}
          </Modal>
          <Modal
            open={asking?.change === "CANCELLED"}
            onClose={() => setAsking(null)}
            title="Cancel this booking?"
          >
            {/* A new form each time it opens, so a reason typed last time is left behind. */}
            {asking?.change === "CANCELLED" && (
              <CancelBookingForm
                booking={asking.reservation}
                onKeep={() => setAsking(null)}
                onSubmit={(reason) => send({ status: "CANCELLED", reason })}
              />
            )}
          </Modal>
        </>
      )}
    </>
  );
}
