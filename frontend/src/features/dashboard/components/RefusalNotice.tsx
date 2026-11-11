import type { ReactElement } from "react";

import { FormNotice } from "@/components/FormNotice";
import { fieldMessages } from "@/features/auth/serverErrors";
import { guestsWords } from "@/features/dashboard/labels";
import { bookingsInTheWay } from "@/features/dashboard/refusals";
import { tableName } from "@/features/dashboard/tables";
import type { ApiError } from "@/lib/api";
import { cx } from "@/lib/cx";
import { formatBookDate } from "@/lib/time";
import type { OwnerReservation } from "@/types/api";

/** The bookings that stand in the way of a change, as short lines: when, who, how many, where. */
export function BookingsInTheWay({
  reservations,
}: {
  reservations: OwnerReservation[];
}): ReactElement {
  return (
    <ul aria-label="Bookings in the way" className="border-t border-line">
      {reservations.map((booking) => (
        <li key={booking.id} className="border-b border-line py-2.5">
          <p className="text-ui font-medium text-ink">
            {formatBookDate(new Date(booking.startsAt))},{" "}
            <span className="tabular-nums">
              {booking.starts}–{booking.ends}
            </span>
          </p>
          <p className="mt-0.5 text-meta text-ink-secondary">
            {booking.guest.name} · {guestsWords(booking.partySize)} ·{" "}
            {tableName(booking.table.label)}
          </p>
        </li>
      ))}
    </ul>
  );
}

interface RefusalNoticeProps {
  error: ApiError | null;
  /** Codes shown somewhere else, such as a taken name under its field. */
  shownElsewhere?: readonly string[];
  className?: string;
}

/**
 * What the server said when it refused a change: its words, then the bookings in the way when
 * that's why. A problem with one field shows under that field instead.
 */
export function RefusalNotice({
  error,
  shownElsewhere = [],
  className,
}: RefusalNoticeProps): ReactElement | null {
  if (!error || shownElsewhere.includes(error.code)) return null;
  if (Object.keys(fieldMessages(error)).length > 0) return null;
  const reservations = bookingsInTheWay(error);
  return (
    <div className={cx("flex flex-col gap-3", className)}>
      <FormNotice tone="error">{error.message}</FormNotice>
      {reservations.length > 0 && <BookingsInTheWay reservations={reservations} />}
    </div>
  );
}
