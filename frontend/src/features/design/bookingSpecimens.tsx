// The booking widget at chosen moments, for /design's screens and its "Book a table" flow: two
// guests at Lori Smokehouse on the demo Saturday, signed in as Lilit.
import type { ReactElement } from "react";

import type { BookingChoices } from "@/features/booking/booking";
import { BookingWidget } from "@/features/booking/components/BookingWidget";
import type {
  AvailabilityState,
  BookingWidgetProps,
} from "@/features/booking/components/BookingWidget";
import { loriSaturday } from "@/features/design/samples";
import type { Availability } from "@/types/api";

const ignore = (): void => {};

export const saturdayForTwo: BookingChoices = {
  date: "2026-11-14",
  guests: 2,
  time: null,
  tableId: null,
};
export const atSeven: BookingChoices = { ...saturdayForTwo, time: "19:00" };
export const atT2: BookingChoices = { ...atSeven, tableId: "table-t2" };

export const loaded = (data: Availability = loriSaturday): AvailabilityState => ({
  data,
  failed: false,
  retrying: false,
  onRetry: ignore,
});

/** The widget at one moment of booking. Today is Friday 13 November, the day before. */
export function bookingAt(props: Partial<BookingWidgetProps> = {}): ReactElement {
  return (
    <BookingWidget
      choices={saturdayForTwo}
      today="2026-11-13"
      availability={loaded()}
      viewer={{ kind: "guest", name: "Lilit Harutyunyan" }}
      sending={false}
      refusal={null}
      booked={null}
      onChoose={ignore}
      onBook={ignore}
      onBookAnother={ignore}
      {...props}
    />
  );
}
