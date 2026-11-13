import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import type { To } from "react-router";

import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { FormNotice } from "@/components/FormNotice";
import { Modal } from "@/components/Modal";
import { Pagination } from "@/components/Pagination";
import { SectionNav } from "@/components/SectionNav";
import { Spinner } from "@/components/Spinner";
import { GuestBookings } from "@/features/reservations/components/GuestBookings";
import { bookingsWords } from "@/features/reservations/reservations";
import type { ReservationsWhen } from "@/features/reservations/reservations";
import { ReviewForm } from "@/features/reviews/components/ReviewForm";
import type { NewReview } from "@/features/reviews/reviews";
import type { ApiError } from "@/lib/api";
import { cx } from "@/lib/cx";
import { formatDayHeading } from "@/lib/time";
import type { GuestReservation, ListResponse } from "@/types/api";

export interface ReservationListState {
  /** The page of bookings, once it has come. */
  data: ListResponse<GuestReservation> | undefined;
  failed: boolean;
  retrying: boolean;
  onRetry: () => void;
}

/** Reviewing a visit: the form over the page, and what came of it. */
export interface ReviewFlowState {
  /** The visit being reviewed, while its form is open. */
  writing: GuestReservation | null;
  /** True while the review is being sent. */
  sending: boolean;
  /** Why the last review was refused, or couldn't be sent. The form shows it, and stays open. */
  error: ApiError | null;
  /** The visit just reviewed, to say so. */
  posted: GuestReservation | null;
  onWrite: (booking: GuestReservation) => void;
  onClose: () => void;
  onPost: (review: NewReview) => void;
}

export interface MyReservationsProps {
  when: ReservationsWhen;
  page: number;
  /** Today in Yerevan, so a day this year is shown without its year. */
  today: string;
  list: ReservationListState;
  /** Where each list and page lives. Lists and pages are links, so Back returns. */
  hrefFor: (when: ReservationsWhen, page?: number) => To;
  /** The booking being cancelled right now. */
  cancellingId: string | null;
  /** The booking just cancelled, to say so. */
  cancelled: GuestReservation | null;
  /** Why the last cancel was refused, or couldn't be sent. */
  refusal: ApiError | null;
  onCancel: (booking: GuestReservation) => void;
  review: ReviewFlowState;
  onFindATable: () => void;
  onFirstPage: () => void;
  /** The level of the days' headings: 2 on the page, lower inside /design. */
  headingLevel?: 2 | 4;
  className?: string;
}

/**
 * The signed-in guest's bookings, upcoming or past, a page at a time, each upcoming one cancellable
 * until it starts. Cancelling asks first, because a table given up may be taken at once. A visit the
 * restaurant marked as arrived can be reviewed once, in a form over the page.
 */
export function MyReservations({
  when,
  page,
  today,
  list,
  hrefFor,
  cancellingId,
  cancelled,
  refusal,
  onCancel,
  review,
  onFindATable,
  onFirstPage,
  headingLevel = 2,
  className,
}: MyReservationsProps): ReactElement {
  const [asking, setAsking] = useState<GuestReservation | null>(null);
  const noticeRef = useRef<HTMLDivElement>(null);

  const { posted } = review;

  // The button just pressed is gone once a booking is cancelled or reviewed, so focus moves to
  // what happened.
  useEffect(() => {
    if (cancelled || refusal || posted) noticeRef.current?.focus();
  }, [cancelled, refusal, posted]);

  function cancel(): void {
    if (asking) onCancel(asking);
    setAsking(null);
  }

  let content: ReactElement;
  if (list.failed) {
    content = (
      <div className="flex flex-col items-center">
        <ErrorState
          title="Our apologies"
          description="We couldn’t load your reservations."
          onRetry={list.onRetry}
          retrying={list.retrying}
          className="w-full max-w-120"
        />
      </div>
    );
  } else if (!list.data) {
    content = (
      <div className="flex min-h-40 items-center justify-center">
        <Spinner label="Loading your reservations" />
      </div>
    );
  } else if (list.data.data.length === 0 && list.data.meta.total > 0) {
    // An old link, or a booking that moved to the other list, can leave a page empty.
    content = (
      <EmptyState
        title="This page is empty"
        description={`There are ${bookingsWords(list.data.meta.total)} on earlier pages.`}
        action={{ label: "Go to the first page", onClick: onFirstPage }}
      />
    );
  } else if (list.data.data.length === 0) {
    content =
      when === "upcoming" ? (
        <EmptyState
          title="No upcoming reservations"
          description="Book a table, and it will be listed here."
          action={{ label: "Find a table", onClick: onFindATable }}
        />
      ) : (
        <EmptyState
          title="No past reservations"
          description="Bookings are listed here once they’re over."
        />
      );
  } else {
    const { data, meta } = list.data;
    content = (
      <div className="flex flex-col gap-8">
        <GuestBookings
          reservations={data}
          today={today}
          cancellingId={cancellingId}
          onCancel={setAsking}
          onReview={review.onWrite}
          headingLevel={headingLevel}
        />
        <Pagination
          page={page}
          pageCount={Math.ceil(meta.total / meta.pageSize)}
          hrefFor={(next) => hrefFor(when, next)}
        />
      </div>
    );
  }

  return (
    <div className={cx("flex flex-col gap-8", className)}>
      <SectionNav
        label="Your reservations"
        links={[
          { to: hrefFor("upcoming"), label: "Upcoming", end: true },
          { to: hrefFor("past"), label: "Past", end: true },
        ]}
      />
      {(cancelled || refusal || posted) && (
        <div ref={noticeRef} tabIndex={-1} className="max-w-160 outline-hidden">
          {refusal ? (
            <FormNotice>{refusal.message}</FormNotice>
          ) : cancelled ? (
            <FormNotice tone="success">
              Your booking at {cancelled.restaurant.name} on{" "}
              {formatDayHeading(cancelled.date, today)} is cancelled.
            </FormNotice>
          ) : (
            posted && (
              <FormNotice tone="success">
                Thank you. Your review of {posted.restaurant.name} is posted.
              </FormNotice>
            )
          )}
        </div>
      )}
      {content}

      <Modal
        open={asking !== null}
        onClose={() => setAsking(null)}
        title="Cancel this booking?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAsking(null)}>
              Keep it
            </Button>
            <Button onClick={cancel}>Cancel booking</Button>
          </>
        }
      >
        {asking &&
          `Your table at ${asking.restaurant.name} on ${formatDayHeading(asking.date, today)} at ${asking.starts} will be offered to other guests.`}
      </Modal>

      <Modal open={review.writing !== null} onClose={review.onClose} title="Review your visit">
        {/* A new form for each visit, so a rating chosen for another is left behind. */}
        {review.writing && (
          <ReviewForm
            key={review.writing.id}
            visit={`${review.writing.restaurant.name} on ${formatDayHeading(review.writing.date, today)}`}
            sending={review.sending}
            error={review.error}
            onPost={review.onPost}
            onClose={review.onClose}
          />
        )}
      </Modal>
    </div>
  );
}
