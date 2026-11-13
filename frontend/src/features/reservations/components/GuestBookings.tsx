import type { ReactElement } from "react";
import { Link } from "react-router";

import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { STATUS_TONES, ZONE_LABELS, guestsWords } from "@/features/dashboard/labels";
import { tableName } from "@/features/dashboard/tables";
import {
  GUEST_STATUS_LABELS,
  byDay,
  guestCancellationWords,
} from "@/features/reservations/reservations";
import { ratingWords } from "@/features/reviews/reviews";
import { cx } from "@/lib/cx";
import { formatDayHeading } from "@/lib/time";
import type { GuestReservation } from "@/types/api";

interface GuestBookingsProps {
  reservations: GuestReservation[];
  /** Today in Yerevan, so a day this year is shown without its year. */
  today: string;
  /** The booking being cancelled right now, whose button waits. */
  cancellingId?: string | null;
  /** Asks to cancel a booking. Without it, no booking offers to be cancelled. */
  onCancel?: (booking: GuestReservation) => void;
  /** Opens the review of a visit. Without it, no visit offers to be reviewed. */
  onReview?: (booking: GuestReservation) => void;
  /** The level of the days' headings: 2 on the page, lower inside /design. */
  headingLevel?: 2 | 4;
}

function BookingLine({
  booking,
  day,
  cancelling,
  onCancel,
  onReview,
}: {
  booking: GuestReservation;
  day: string;
  cancelling: boolean;
  onCancel?: (booking: GuestReservation) => void;
  onReview?: (booking: GuestReservation) => void;
}): ReactElement {
  const {
    status,
    starts,
    ends,
    restaurant,
    table,
    partySize,
    specialRequests,
    cancellation,
    review,
  } = booking;
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
        <Badge tone={STATUS_TONES[status]}>{GUEST_STATUS_LABELS[status]}</Badge>
      </div>
      <div className="col-span-2 min-w-0 sm:col-span-1">
        <p className={cx("font-display text-title-xs break-words", crossedOut)}>
          <Link
            to={`/restaurants/${restaurant.slug}`}
            className="underline decoration-transparent decoration-1 underline-offset-4 transition-[text-decoration-color] duration-button hover:decoration-current"
          >
            {restaurant.name}
          </Link>
        </p>
        <p className="mt-0.5 text-meta text-ink-secondary">
          {tableName(table.label)} · {ZONE_LABELS[table.zone]} · {guestsWords(partySize)}
        </p>
        {specialRequests && (
          <p className="mt-2 text-meta break-words text-ink-secondary">
            <span className="font-medium text-ink">Your note:</span> {specialRequests}
          </p>
        )}
        {cancellation && (
          <p className="mt-2 text-meta break-words text-ink-secondary">
            {guestCancellationWords(cancellation)}
          </p>
        )}
        {review && (
          <p className="mt-2 line-clamp-3 text-meta break-words text-ink-secondary">
            <span className="font-medium text-ink">Your review:</span> {ratingWords(review.rating)}.
            {review.comment && ` ${review.comment}`}
          </p>
        )}
        {booking.canReview && onReview && (
          <Button
            variant="link"
            className="mt-2"
            aria-label={`Review your visit, ${restaurant.name}, ${day}, ${starts}`}
            onClick={() => onReview(booking)}
          >
            Review your visit
          </Button>
        )}
        {booking.canCancel && onCancel && (
          <Button
            variant="link"
            className="mt-2"
            aria-label={`Cancel booking, ${restaurant.name}, ${day}, ${starts}`}
            loading={cancelling}
            onClick={() => onCancel(booking)}
          >
            Cancel booking
          </Button>
        )}
      </div>
    </li>
  );
}

/**
 * The guest's own pages of the book: each day under its name, then one ruled line per booking,
 * as the restaurant's book has them. A cancelled booking stays, crossed out, with who cancelled
 * it and why.
 */
export function GuestBookings({
  reservations,
  today,
  cancellingId = null,
  onCancel,
  onReview,
  headingLevel = 2,
}: GuestBookingsProps): ReactElement {
  const Heading = headingLevel === 2 ? "h2" : "h4";
  return (
    <div className="flex flex-col gap-8">
      {byDay(reservations).map(({ date, bookings }) => {
        const day = formatDayHeading(date, today);
        return (
          <div key={date}>
            <Heading className="text-eyebrow text-ink-muted uppercase">{day}</Heading>
            <ul className="mt-2 border-t border-line">
              {bookings.map((booking) => (
                <BookingLine
                  key={booking.id}
                  booking={booking}
                  day={day}
                  cancelling={cancellingId === booking.id}
                  onCancel={onCancel}
                  onReview={onReview}
                />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
