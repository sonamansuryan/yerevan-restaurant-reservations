import type { ReactElement } from "react";
import { Link } from "react-router";

import { Badge } from "@/components/Badge";
import { Button, LinkButton } from "@/components/Button";
import { CalendarIcon, ClockIcon, PinIcon, UsersIcon } from "@/components/icons";
import { GUEST_STATUS_TONES, ZONE_LABELS, guestsWords } from "@/features/dashboard/labels";
import { tableName } from "@/features/dashboard/tables";
import { GUEST_STATUS_LABELS, guestCancellationWords } from "@/features/reservations/reservations";
import { toneFor } from "@/features/restaurants/tones";
import { ratingWords } from "@/features/reviews/reviews";
import { cx } from "@/lib/cx";
import { photoUrl } from "@/lib/images";
import { formatDayHeading, formatWeekdayDate } from "@/lib/time";
import type { GuestReservation } from "@/types/api";

/** What a booking's card shows of its restaurant beyond its name: its photo and its map link. */
export interface BookedPlace {
  cover: string | null;
  mapsUrl: string;
}

interface GuestBookingsProps {
  reservations: GuestReservation[];
  /** Today in Yerevan, so a day this year is shown without its year. */
  today: string;
  /** Each restaurant's photo and map link, by its slug, once they've come. */
  placeFor?: (slug: string) => BookedPlace | undefined;
  /** The booking being cancelled right now, whose button waits. */
  cancellingId?: string | null;
  /** Asks to cancel a booking. Without it, no booking offers to be cancelled. */
  onCancel?: (booking: GuestReservation) => void;
  /** Opens the review of a visit. Without it, no visit offers to be reviewed. */
  onReview?: (booking: GuestReservation) => void;
  /** The level of each restaurant's name: 2 on the page, lower inside /design. */
  headingLevel?: 2 | 4;
}

/** The restaurant's photo, or its tone while there's none, as the export's cards begin. */
function Thumb({ slug, place }: { slug: string; place: BookedPlace | undefined }): ReactElement {
  const box = "h-35 w-40 flex-none rounded-hero";
  if (place?.cover) {
    return (
      <img
        src={photoUrl(place.cover, 400)}
        alt=""
        loading="lazy"
        className={cx(box, "object-cover")}
      />
    );
  }
  // Still loading: a quiet blank. No photo: the restaurant's own tone, as its card on Browse.
  return <span aria-hidden="true" className={cx(box, place ? toneFor(slug) : "bg-fill-slot")} />;
}

const newTab = { target: "_blank", rel: "noopener noreferrer" } as const;

function BookingCard({
  booking,
  today,
  place,
  cancelling,
  onCancel,
  onReview,
  headingLevel,
}: {
  booking: GuestReservation;
  today: string;
  place: BookedPlace | undefined;
  cancelling: boolean;
  onCancel?: (booking: GuestReservation) => void;
  onReview?: (booking: GuestReservation) => void;
  headingLevel: 2 | 4;
}): ReactElement {
  const {
    status,
    date,
    starts,
    ends,
    restaurant,
    table,
    partySize,
    specialRequests,
    cancellation,
    review,
  } = booking;
  const Heading = headingLevel === 2 ? "h2" : "h4";
  const cancelled = status === "CANCELLED";
  const day = formatDayHeading(date, today);
  const reviewing = booking.canReview && onReview;
  const cancellable = booking.canCancel && onCancel;
  // Directions are for a table still to come.
  const directions = booking.canCancel && place?.mapsUrl;

  return (
    <li className="flex flex-wrap gap-5 rounded-band border border-line bg-surface-raised p-4">
      <Thumb slug={restaurant.slug} place={place} />
      <div className="flex min-w-0 flex-[1_1_17.5rem] flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Heading
            className={cx(
              "min-w-0 text-title-xs font-semibold break-words",
              // Struck through, like a line crossed out. The badge says it in words.
              cancelled && "text-ink-muted line-through",
            )}
          >
            <Link
              to={`/restaurants/${restaurant.slug}`}
              className="underline decoration-transparent decoration-1 underline-offset-4 transition-[text-decoration-color] duration-button hover:decoration-current"
            >
              {restaurant.name}
            </Link>
          </Heading>
          <Badge tone={GUEST_STATUS_TONES[status]}>{GUEST_STATUS_LABELS[status]}</Badge>
        </div>
        <p className="flex flex-wrap gap-x-6 gap-y-2 text-input text-ink-body">
          <span className="flex items-center gap-1.5">
            <CalendarIcon className="flex-none text-ink-secondary" />
            <span aria-hidden="true">{formatWeekdayDate(date, today)}</span>
            <span className="sr-only">{day}</span>
          </span>
          <span className="flex items-center gap-1.5 tabular-nums">
            <ClockIcon className="flex-none text-ink-secondary" />
            <span aria-hidden="true">{starts}</span>
            <span className="sr-only">
              {starts} to {ends}
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <UsersIcon className="flex-none text-ink-secondary" />
            {guestsWords(partySize)}
          </span>
        </p>
        <p className="text-ui text-ink-secondary">
          {tableName(table.label)} · {ZONE_LABELS[table.zone]} · until {ends}
        </p>
        {specialRequests && (
          <p className="text-ui break-words text-ink-secondary">
            <span className="font-semibold text-ink">Your note:</span> {specialRequests}
          </p>
        )}
        {cancellation && (
          <p className="text-ui break-words text-ink-secondary">
            {guestCancellationWords(cancellation)}
          </p>
        )}
        {review && (
          <p className="line-clamp-3 text-ui break-words text-ink-secondary">
            <span className="font-semibold text-ink">Your review:</span>{" "}
            {ratingWords(review.rating)}.{review.comment && ` ${review.comment}`}
          </p>
        )}
        {(directions || reviewing || cancellable) && (
          <div className="mt-auto flex flex-wrap gap-2 pt-1">
            {directions && (
              <LinkButton
                variant="ghost"
                size="small"
                to={directions}
                {...newTab}
                aria-label={`Directions to ${restaurant.name}, opens in a new tab`}
              >
                <PinIcon />
                Directions
              </LinkButton>
            )}
            {reviewing && (
              <Button
                size="small"
                aria-label={`Review your visit, ${restaurant.name}, ${day}, ${starts}`}
                onClick={() => reviewing(booking)}
              >
                Review your visit
              </Button>
            )}
            {cancellable && (
              <Button
                variant="danger"
                size="small"
                aria-label={`Cancel reservation, ${restaurant.name}, ${day}, ${starts}`}
                loading={cancelling}
                onClick={() => cancellable(booking)}
              >
                Cancel reservation
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * The guest's bookings, as the export lists them: a white card each, the restaurant's photo, its
 * name and how the booking stands, the day, time and party, the table, and what can still be done
 * with it: directions, a review of a visit, or cancelling. A cancelled booking stays, crossed out,
 * with who cancelled it and why.
 */
export function GuestBookings({
  reservations,
  today,
  placeFor,
  cancellingId = null,
  onCancel,
  onReview,
  headingLevel = 2,
}: GuestBookingsProps): ReactElement {
  return (
    <ul className="flex flex-col gap-4">
      {reservations.map((booking) => (
        <BookingCard
          key={booking.id}
          booking={booking}
          today={today}
          place={placeFor?.(booking.restaurant.slug)}
          cancelling={cancellingId === booking.id}
          onCancel={onCancel}
          onReview={onReview}
          headingLevel={headingLevel}
        />
      ))}
    </ul>
  );
}
