import { useEffect, useRef } from "react";
import type { ReactElement } from "react";

import { FormNotice } from "@/components/FormNotice";
import { reserveLabel } from "@/features/booking/booking";
import type { BookingChoices, Viewer } from "@/features/booking/booking";
import { BookingConfirm } from "@/features/booking/components/BookingConfirm";
import { BookingDone } from "@/features/booking/components/BookingDone";
import { DayChoice } from "@/features/booking/components/DayChoice";
import { GuestStepper } from "@/features/booking/components/GuestStepper";
import { TableChoice } from "@/features/booking/components/TableChoice";
import { TimeChoice } from "@/features/booking/components/TimeChoice";
import type { ApiError } from "@/lib/api";
import type { Availability, GuestReservation } from "@/types/api";

export interface AvailabilityState {
  data: Availability | undefined;
  failed: boolean;
  retrying: boolean;
  onRetry: () => void;
}

export interface BookingWidgetProps {
  choices: BookingChoices;
  /** Today in Yerevan, the earliest date to choose. */
  today: string;
  availability: AvailabilityState;
  viewer: Viewer;
  sending: boolean;
  /** Why the last booking was refused, until the next choice. */
  refusal: ApiError | null;
  booked: GuestReservation | null;
  onChoose: (change: Partial<BookingChoices>) => void;
  onBook: (specialRequests: string) => void;
  onBookAnother: () => void;
}

/**
 * Booking a table on a restaurant's page, as the export's panel has it: the party, the day, a time,
 * a table, then one button that says what it books. The tables appear once a time is chosen, and
 * changing an earlier choice clears the ones after it.
 */
export function BookingWidget({
  choices,
  today,
  availability,
  viewer,
  sending,
  refusal,
  booked,
  onChoose,
  onBook,
  onBookAnother,
}: BookingWidgetProps): ReactElement {
  // A choice only counts while it's still free, so a table someone else has just taken drops out.
  const slot = availability.data?.slots.find(
    ({ starts, tables }) => starts === choices.time && tables.length > 0,
  );
  const table = slot?.tables.find(({ id }) => id === choices.tableId);

  // A choice still in the address that isn't free any more: someone else took it, perhaps from
  // another window, and the free tables have just been asked for again.
  let gone: string | null = null;
  if (choices.time && availability.data && !slot) {
    gone = `${choices.time} isn’t free any more. Choose another time.`;
  } else if (choices.tableId && slot && !table) {
    gone = `The table you chose isn’t free at ${slot.starts} any more. Choose another.`;
  }

  // A refusal shows by the step to choose again: above the tables or times when the choice has
  // gone, or by the button when it's still free, as after a lost connection.
  const message = table ? null : (refusal?.message ?? gone);
  const noticeRef = useRef<HTMLDivElement>(null);
  const refusedChoice = refusal !== null && !table;
  // The button just pressed went with the table, so focus moves to the reason instead.
  useEffect(() => {
    if (refusedChoice) noticeRef.current?.focus();
  }, [refusedChoice]);

  if (booked) {
    return (
      <BookingDone
        reservation={booked}
        guestName={viewer.kind === "guest" ? viewer.name : ""}
        today={today}
        onBookAnother={onBookAnother}
      />
    );
  }

  const notice = message && (
    <div ref={noticeRef} tabIndex={-1} className="outline-hidden">
      <FormNotice>{message}</FormNotice>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <GuestStepper
        guests={choices.guests}
        onChange={(guests) => onChoose({ guests, time: null, tableId: null })}
      />
      <DayChoice
        date={choices.date}
        today={today}
        last={availability.data?.bookingWindow.last}
        onChoose={(date) => onChoose({ date, time: null, tableId: null })}
      />

      {!slot && notice}
      <TimeChoice
        availability={availability}
        guests={choices.guests}
        chosen={slot?.starts ?? null}
        onChoose={(time) => onChoose({ time, tableId: null })}
      />

      {slot && (
        <div className="flex flex-col gap-3">
          {notice}
          <TableChoice
            time={slot.starts}
            tables={slot.tables}
            chosen={table?.id ?? null}
            onChoose={(tableId) => onChoose({ tableId })}
          />
        </div>
      )}

      <BookingConfirm
        missing={!slot ? "time" : !table ? "table" : null}
        label={slot ? reserveLabel(choices.guests, choices.date, slot.starts) : ""}
        ends={slot && table ? slot.ends : null}
        viewer={viewer}
        sending={sending}
        refusal={refusal}
        onBook={onBook}
      />
    </div>
  );
}
