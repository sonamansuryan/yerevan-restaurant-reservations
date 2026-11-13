import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import type { MyReservationsProps } from "@/features/reservations/components/MyReservations";
import { useCancelReservation } from "@/features/reservations/hooks/useCancelReservation";
import { useBookedPlaces } from "@/features/reservations/hooks/useBookedPlaces";
import { useReservationList } from "@/features/reservations/hooks/useReservationList";
import { pageFrom, reservationsPath } from "@/features/reservations/reservations";
import type { ReservationsWhen } from "@/features/reservations/reservations";
import { usePostReview } from "@/features/reviews/hooks/usePostReview";
import { yerevanToday } from "@/lib/time";
import type { GuestReservation } from "@/types/api";

/**
 * My reservations, for one list: the page of bookings in the address, cancelling one, and reviewing
 * a visit. What was said about a cancel or a review clears when the other starts, so only the latest
 * is shown.
 */
export function useMyReservations(when: ReservationsWhen): MyReservationsProps {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  // Read once, when the page opens, so the days don't change under someone at midnight.
  const [today] = useState(() => yerevanToday());
  const page = pageFrom(params);
  const list = useReservationList(when, page);
  // The other list's first page, for its count on its tab, and for the latest visit to review.
  // It's the page that list opens on, so switching to it is instant.
  const otherWhen: ReservationsWhen = when === "upcoming" ? "past" : "upcoming";
  const other = useReservationList(otherWhen, 1);
  const placeFor = useBookedPlaces(
    (list.data?.data ?? []).map(({ restaurant }) => restaurant.slug),
  );
  // Visits put away with Later, for as long as the page is open.
  const [later, setLater] = useState<string[]>([]);
  const cancel = useCancelReservation();
  const post = usePostReview();
  const [writing, setWriting] = useState<GuestReservation | null>(null);
  const { reset: resetCancel } = cancel;
  const { reset: resetReview } = post;

  // What was said about the last cancel or review belongs to the page it was made on.
  useEffect(() => {
    resetCancel();
    resetReview();
  }, [page, resetCancel, resetReview]);

  // A retry clears the error while it runs. Staying on the error keeps Try again in its place.
  const retrying = list.isFetching && list.errorUpdateCount > 0;

  // Past bookings come latest first, so the first that can be reviewed is the latest visit.
  const visit =
    when === "upcoming"
      ? (other.data?.data.find((booking) => booking.canReview && !later.includes(booking.id)) ??
        null)
      : null;
  const postingVisit = visit !== null && post.variables?.booking.id === visit.id;

  return {
    when,
    page,
    today,
    list: {
      data: list.data,
      failed: list.isError || retrying,
      retrying,
      onRetry: () => void list.refetch(),
    },
    counts: { [when]: list.data?.meta.total, [otherWhen]: other.data?.meta.total },
    placeFor,
    visit: visit && {
      booking: visit,
      sending: postingVisit && post.isPending,
      error: postingVisit ? post.error : null,
      onPost: (review) => {
        resetCancel();
        post.mutate({ booking: visit, review });
      },
      onLater: () => setLater((ids) => [...ids, visit.id]),
    },
    hrefFor: reservationsPath,
    cancellingId: cancel.isPending ? (cancel.variables?.id ?? null) : null,
    cancelled: cancel.data ?? null,
    refusal: cancel.error,
    onCancel: (booking) => {
      resetReview();
      cancel.mutate(booking);
    },
    review: {
      writing,
      sending: post.isPending,
      error: post.error,
      posted: post.isSuccess ? post.variables.booking : null,
      onWrite: (booking) => {
        resetCancel();
        resetReview();
        setWriting(booking);
      },
      onClose: () => setWriting(null),
      // The form closes once the review is posted. Refused, it stays open with the words written.
      onPost: (review) => {
        if (writing)
          post.mutate({ booking: writing, review }, { onSuccess: () => setWriting(null) });
      },
    },
    onFindATable: () => void navigate("/restaurants"),
    onFirstPage: () => void navigate(reservationsPath(when)),
  };
}
