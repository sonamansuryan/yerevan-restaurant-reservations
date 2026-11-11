import { useEffect, useRef } from "react";
import type { ReactElement } from "react";

import { FormNotice } from "@/components/FormNotice";
import { changeDoneWords } from "@/features/dashboard/bookingChanges";
import type { ApiError } from "@/lib/api";
import { cx } from "@/lib/cx";
import type { OwnerReservation } from "@/types/api";

interface BookingChangeNoticeProps {
  /** The booking just changed, as the server answered it. */
  changed: OwnerReservation | null;
  /** Why the last change was refused, or couldn't be sent. */
  refusal: ApiError | null;
  className?: string;
}

/**
 * What the last change to a booking did, or why it didn't happen. The button just pressed is gone
 * once the booking has moved on, so focus moves here.
 */
export function BookingChangeNotice({
  changed,
  refusal,
  className,
}: BookingChangeNoticeProps): ReactElement | null {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (changed || refusal) ref.current?.focus();
  }, [changed, refusal]);

  if (!changed && !refusal) return null;
  return (
    <div ref={ref} tabIndex={-1} className={cx("max-w-160 outline-hidden", className)}>
      {refusal ? (
        <FormNotice>{refusal.message}</FormNotice>
      ) : (
        changed && <FormNotice tone="success">{changeDoneWords(changed)}</FormNotice>
      )}
    </div>
  );
}
