import type { ReactElement } from "react";

import { FormNotice } from "@/components/FormNotice";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { GUEST_COUNTS, guestsLabel, readBack } from "@/features/booking/booking";
import type { BookingChoices, Viewer } from "@/features/booking/booking";
import { BookingConfirm } from "@/features/booking/components/BookingConfirm";
import { BookingDone } from "@/features/booking/components/BookingDone";
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
 * Booking a table on a restaurant's page, one choice after another: the date and the party, a
 * time, a table, then the booking said back with one button. Each step appears once the one
 * before it is chosen, and changing an earlier choice clears the ones after it.
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

  // A choice only counts while it's still free, so a table someone else has just taken drops out.
  const slot = availability.data?.slots.find(
    ({ starts, tables }) => starts === choices.time && tables.length > 0,
  );
  const table = slot?.tables.find(({ id }) => id === choices.tableId);
  // A refusal shows by the step to choose again: above the tables when the table has gone, or by
  // the button when it's still free, as after a lost connection.
  const notice = refusal && !table && <FormNotice>{refusal.message}</FormNotice>;

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-x-6">
        <Input
          label="Date"
          type="date"
          required
          value={choices.date}
          min={today}
          max={availability.data?.bookingWindow.last}
          onChange={(event) => {
            // A date that's only half typed is empty, and changes nothing yet.
            if (event.target.value)
              onChoose({ date: event.target.value, time: null, tableId: null });
          }}
        />
        <Select
          label="Guests"
          value={choices.guests}
          onChange={(event) =>
            onChoose({ guests: Number(event.target.value), time: null, tableId: null })
          }
        >
          {GUEST_COUNTS.map((count) => (
            <option key={count} value={count}>
              {guestsLabel(count)}
            </option>
          ))}
        </Select>
      </div>

      {!slot && notice}
      <TimeChoice
        availability={availability}
        guests={choices.guests}
        chosen={slot?.starts ?? null}
        onChoose={(time) => onChoose({ time, tableId: null })}
      />

      {slot && (
        <div className="flex flex-col gap-4">
          {notice}
          <TableChoice
            time={slot.starts}
            tables={slot.tables}
            chosen={table?.id ?? null}
            onChoose={(tableId) => onChoose({ tableId })}
          />
        </div>
      )}

      {slot && table && (
        <BookingConfirm
          readBack={readBack(choices.guests, choices.date, slot.starts, table.zone, today)}
          details={`Table ${table.label} · until ${slot.ends}`}
          viewer={viewer}
          sending={sending}
          refusal={refusal}
          onBook={onBook}
        />
      )}
    </div>
  );
}
