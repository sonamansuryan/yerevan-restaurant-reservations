import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import type { MyReservationsProps } from "@/features/reservations/components/MyReservations";
import { useCancelReservation } from "@/features/reservations/hooks/useCancelReservation";
import { useReservationList } from "@/features/reservations/hooks/useReservationList";
import { pageFrom, reservationsPath } from "@/features/reservations/reservations";
import type { ReservationsWhen } from "@/features/reservations/reservations";
import { yerevanToday } from "@/lib/time";

/** My reservations, for one list: the page of bookings in the address, and cancelling one. */
export function useMyReservations(when: ReservationsWhen): MyReservationsProps {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  // Read once, when the page opens, so the days don't change under someone at midnight.
  const [today] = useState(() => yerevanToday());
  const page = pageFrom(params);
  const list = useReservationList(when, page);
  const cancel = useCancelReservation();
  const { reset } = cancel;

  // What was said about the last cancel belongs to the page it was made on.
  useEffect(() => {
    reset();
  }, [page, reset]);

  // A retry clears the error while it runs. Staying on the error keeps Try again in its place.
  const retrying = list.isFetching && list.errorUpdateCount > 0;

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
    hrefFor: reservationsPath,
    cancellingId: cancel.isPending ? (cancel.variables?.id ?? null) : null,
    cancelled: cancel.data ?? null,
    refusal: cancel.error,
    onCancel: (booking) => cancel.mutate(booking),
    onFindATable: () => void navigate("/restaurants"),
    onFirstPage: () => void navigate(reservationsPath(when)),
  };
}
