import type { ReactElement } from "react";
import type { To } from "react-router";

import { Badge } from "@/components/Badge";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { RESERVATION_STATUSES, isFiltered, oneOf } from "@/features/admin/admin";
import type { AdminReservationFilters } from "@/features/admin/admin";
import { AdminFilterBar } from "@/features/admin/components/AdminFilterBar";
import { AdminListBody } from "@/features/admin/components/AdminListBody";
import type { AdminListState, AdminListWords } from "@/features/admin/components/AdminListBody";
import { STATUS_LABELS, STATUS_TONES, guestsWords } from "@/features/dashboard/labels";
import { tableName } from "@/features/dashboard/tables";
import { bookingsWords } from "@/features/reservations/reservations";
import { cx } from "@/lib/cx";
import { formatDayHeading, isCalendarDate } from "@/lib/time";
import type { AdminReservation } from "@/types/api";

const words: AdminListWords = {
  label: "Reservations",
  loading: "Loading the reservations",
  what: "the reservations",
  count: bookingsWords,
  none: {
    title: "No reservations yet",
    description: "Bookings appear here as soon as guests make them.",
  },
  noMatch: {
    title: "No reservations match",
    description: "Try a different search, status or day.",
  },
};

function ReservationLine({
  reservation,
  today,
}: {
  reservation: AdminReservation;
  today: string;
}): ReactElement {
  const { status, date, starts, ends, restaurant, guest, table, partySize } = reservation;
  // Struck through, as on the restaurant's own page of the book. The badge says it in words.
  const crossedOut = status === "CANCELLED" && "text-ink-muted line-through";
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 gap-y-1 border-b border-line py-4 sm:grid-cols-[12rem_minmax(0,1fr)_auto]">
      <p className={cx("text-ui font-medium", crossedOut)}>
        {formatDayHeading(date, today)}
        <span aria-hidden="true" className="block tabular-nums">
          {starts}–{ends}
        </span>
        <span className="sr-only">
          , {starts} to {ends}
        </span>
      </p>
      <div className="justify-self-end sm:order-last">
        <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>
      </div>
      <div className="col-span-2 min-w-0 sm:col-span-1">
        <p className={cx("font-display text-title-xs break-words", crossedOut)}>
          {restaurant.name}
        </p>
        <p className="mt-0.5 text-meta break-words text-ink-secondary">
          {guest.name} · {guest.email}
        </p>
        <p className="text-meta text-ink-secondary">
          {tableName(table.label)} · {guestsWords(partySize)}
        </p>
      </div>
    </li>
  );
}

export interface AdminReservationsProps {
  filters: AdminReservationFilters;
  onFiltersChange: (filters: AdminReservationFilters) => void;
  list: AdminListState<AdminReservation>;
  hrefFor: (page: number) => To;
  /** Today in Yerevan, so a day this year is shown without its year. */
  today: string;
  className?: string;
}

/**
 * Every booking on Seghan, the latest start first, at every restaurant, to look through. Each line
 * has its day and times on the restaurant's clock, the restaurant, the guest and the table. They're
 * changed only by their guests and restaurants, so there's nothing to press here.
 */
export function AdminReservations({
  filters,
  onFiltersChange,
  list,
  hrefFor,
  today,
  className,
}: AdminReservationsProps): ReactElement {
  const change = (next: Partial<AdminReservationFilters>): void =>
    onFiltersChange({ ...filters, ...next, page: 1 });

  return (
    <div className={cx("flex flex-col gap-8", className)}>
      <AdminFilterBar
        key={filters.q ?? ""}
        label="Reservations"
        q={filters.q}
        placeholder="Restaurant, guest or email"
        onSearch={(q) => change({ q })}
        choices={2}
      >
        <Select
          label="Status"
          value={filters.status ?? ""}
          onChange={(event) => change({ status: oneOf(RESERVATION_STATUSES, event.target.value) })}
        >
          <option value="">Any status</option>
          {RESERVATION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
        {/* Browsers send a change only for a whole date, or when it's cleared. */}
        <Input
          type="date"
          label="Day"
          value={filters.date ?? ""}
          onChange={(event) =>
            change({ date: isCalendarDate(event.target.value) ? event.target.value : undefined })
          }
        />
      </AdminFilterBar>

      <AdminListBody
        list={list}
        words={words}
        filtered={isFiltered(filters)}
        onClearFilters={() => onFiltersChange({ page: 1 })}
        onFirstPage={() => onFiltersChange({ ...filters, page: 1 })}
        hrefFor={hrefFor}
      >
        {(reservations) => (
          <ul className="border-t border-line">
            {reservations.map((reservation) => (
              <ReservationLine key={reservation.id} reservation={reservation} today={today} />
            ))}
          </ul>
        )}
      </AdminListBody>
    </div>
  );
}
