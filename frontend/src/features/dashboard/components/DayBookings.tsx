import { useState } from "react";
import type { ReactElement } from "react";

import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import type { ButtonVariant } from "@/components/Button";
import { SearchIcon } from "@/components/icons";
import { Modal } from "@/components/Modal";
import { CHANGE_ORDER, changeLabel } from "@/features/dashboard/bookingChanges";
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
import type { OwnerReservation, ReservationStatus, RestaurantChange } from "@/types/api";

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

// Each change's look, as the export's dashboard has them: confirming in ink, a guest's arrival in
// green, a no-show as an outline, and cancelling as an outline in wine.
const CHANGE_LOOKS: Record<RestaurantChange, ButtonVariant> = {
  CONFIRMED: "primary",
  ARRIVED: "success",
  NO_SHOW: "ghost",
  CANCELLED: "danger",
};

// The columns, from 768px: time, guest, party, table, status and the changes. On a phone each
// booking stacks: the time and status, the guest, the party and table, then the changes.
const columns =
  "md:grid-cols-[4.5rem_minmax(0,1.6fr)_5.5rem_minmax(0,1fr)_7rem_minmax(0,1.7fr)] md:gap-x-4";

function BookingLine({ reservation, onAct, changing }: BookingLineProps): ReactElement {
  const { id, status, starts, ends, guest, table, partySize, specialRequests, cancellation } =
    reservation;
  // Struck through, like a line crossed out in the book. The badge says it in words.
  const crossedOut = status === "CANCELLED" && "text-ink-muted line-through";
  // Only the changes the server allows now, the usual next step first.
  const actions = CHANGE_ORDER.filter((change) => reservation.actions.includes(change));
  const sending = changing?.id === id ? changing.status : null;
  return (
    <li
      className={cx(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-t border-line-soft px-4 py-3.5",
        columns,
      )}
    >
      <p className={cx("font-bold tabular-nums md:text-input", crossedOut)}>
        <span aria-hidden="true">{starts}</span>
        <span className="sr-only">
          {starts} to {ends}
        </span>
        <span aria-hidden="true" className="block text-caption font-normal text-ink-secondary">
          to {ends}
        </span>
      </p>
      <div className="justify-self-end md:order-5 md:justify-self-start">
        <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>
      </div>
      <div className="col-span-2 min-w-0 md:order-2 md:col-span-1">
        <p className={cx("font-semibold break-words", crossedOut)}>{guest.name}</p>
        {specialRequests && (
          <p className="mt-0.5 text-meta break-words text-ink-secondary">{specialRequests}</p>
        )}
        {cancellation && (
          <p className="mt-0.5 text-meta break-words text-ink-secondary">
            {cancellationWords(cancellation)}
          </p>
        )}
      </div>
      <p className="text-ui md:order-3">{guestsWords(partySize)}</p>
      <p className="justify-self-end text-ui md:order-4 md:justify-self-start">
        {tableName(table.label)}
        <span className="block text-meta text-ink-secondary">{ZONE_LABELS[table.zone]}</span>
      </p>
      {onAct && actions.length > 0 && (
        <div className="col-span-2 flex flex-wrap gap-1.5 md:order-6 md:col-span-1 md:justify-end">
          {actions.map((change) => (
            <Button
              key={change}
              variant={CHANGE_LOOKS[change]}
              size="compact"
              aria-label={`${changeLabel(change, status)}, ${guest.name}, ${starts}`}
              loading={sending === change}
              // One change at a time for a booking: the others wait for the answer.
              disabled={sending !== null && sending !== change}
              onClick={() => onAct(reservation, change)}
            >
              {changeLabel(change, status)}
            </Button>
          ))}
        </div>
      )}
    </li>
  );
}

/** Which bookings show: all of them, or one status. */
export type DayFilter = "ALL" | ReservationStatus;

const FILTERS: readonly DayFilter[] = [
  "ALL",
  "PENDING",
  "CONFIRMED",
  "ARRIVED",
  "NO_SHOW",
  "CANCELLED",
];

const filterButton =
  "inline-flex h-9 items-center rounded-chip px-3.5 text-meta font-semibold whitespace-nowrap transition-[background-color,color] duration-button any-pointer-coarse:h-11";

interface DayBookingsProps {
  reservations: OwnerReservation[];
  /** Sends a change to a booking. Without it, the day is only read. */
  onChange?: (reservation: OwnerReservation, change: BookingChange) => void;
  /** The change being sent, whose button waits. */
  changing?: ChangeInFlight | null;
  /**
   * Whether the statuses and the search can narrow the list: only when the whole day is on this
   * page, because the counts would otherwise be wrong.
   */
  narrowing?: boolean;
}

/**
 * A day's bookings, as the export's dashboard lists them: one white panel with the statuses to show,
 * each with its count, and a search for a guest, then a row per booking, by time and then table,
 * under the columns' names: the time, the guest and their note, the party, the table, the status,
 * and the changes the booking allows. On a phone each row stacks. A cancelled booking stays,
 * crossed out.
 *
 * Each booking offers the changes the server allows now. Confirming and marking a guest arrived
 * happen at once. Cancelling and marking a no-show ask first, because a no-show can't be undone
 * and a cancelled table may be booked straight away.
 */
export function DayBookings({
  reservations,
  onChange,
  changing = null,
  narrowing = true,
}: DayBookingsProps): ReactElement {
  const [filter, setFilter] = useState<DayFilter>("ALL");
  const [search, setSearch] = useState("");
  const count = (shown: DayFilter): number =>
    shown === "ALL"
      ? reservations.length
      : reservations.filter(({ status }) => status === shown).length;
  const words = search.trim().toLowerCase();
  const shown = narrowing
    ? reservations.filter(
        (reservation) =>
          (filter === "ALL" || reservation.status === filter) &&
          (!words ||
            reservation.guest.name.toLowerCase().includes(words) ||
            reservation.table.label.toLowerCase().includes(words)),
      )
    : reservations;
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
      <div className="min-w-0 overflow-hidden rounded-band border border-line bg-surface-raised">
        {narrowing && (
          <div className="flex flex-wrap items-center gap-1.5 p-3">
            <div role="group" aria-label="Show" className="flex flex-wrap gap-1">
              {FILTERS.filter((one) => one === "ALL" || one === filter || count(one) > 0).map(
                (one) => (
                  <button
                    key={one}
                    type="button"
                    aria-pressed={filter === one}
                    onClick={() => setFilter(one)}
                    className={cx(
                      filterButton,
                      filter === one
                        ? "bg-ink text-on-dark"
                        : "text-ink-secondary hover:bg-fill-hover hover:text-ink",
                    )}
                  >
                    {one === "ALL" ? "All" : STATUS_LABELS[one]} ({count(one)})
                  </button>
                ),
              )}
            </div>
            <label className="relative w-full sm:ml-auto sm:w-56">
              <span className="sr-only">Search guests or tables</span>
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-secondary" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search guests or tables"
                className="h-9 w-full rounded-chip border border-line bg-surface-raised pr-3 pl-9 text-ui text-ink transition-[border-color] duration-button hover:border-ink focus:border-accent focus:outline-hidden any-pointer-coarse:h-11"
              />
            </label>
          </div>
        )}
        {/* The columns' names, for the eye: each row says its own in full to screen readers. */}
        <div
          aria-hidden="true"
          className={cx(
            "hidden border-t border-line-soft px-4 py-3 text-caption font-semibold tracking-label text-ink-secondary uppercase md:grid",
            columns,
          )}
        >
          <span>Time</span>
          <span>Guest</span>
          <span>Party</span>
          <span>Table</span>
          <span>Status</span>
          <span className="text-right">Actions</span>
        </div>
        {shown.length > 0 ? (
          <ul>
            {shown.map((reservation) => (
              <BookingLine
                key={reservation.id}
                reservation={reservation}
                onAct={onChange ? act : undefined}
                changing={changing}
              />
            ))}
          </ul>
        ) : (
          <p className="border-t border-line-soft px-4 py-8 text-center text-ui text-ink-secondary">
            No bookings match.
          </p>
        )}
      </div>

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
