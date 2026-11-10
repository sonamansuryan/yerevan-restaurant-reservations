import { describe, expect, test } from "vitest";

import { cancellationWords, daySummary, guestsWords } from "@/features/dashboard/labels";
import { fridayBookings } from "@/features/design/samples";

describe("a day's bookings in words", () => {
  test("the guests expected, then each status, the way a maître d' would count them", () => {
    // Arrived 2, confirmed 4 and 2, pending 6. The no-show and the cancelled table aren't expected.
    expect(daySummary(fridayBookings)).toBe(
      "14 guests · 2 confirmed · 1 pending · 1 arrived · 1 no-show · 1 cancelled",
    );
  });

  test("a day of only cancellations expects nobody", () => {
    const cancelled = fridayBookings.filter((booking) => booking.status === "CANCELLED");

    expect(daySummary(cancelled)).toBe("1 cancelled");
  });

  test("one guest, or several", () => {
    expect(guestsWords(1)).toBe("1 guest");
    expect(guestsWords(4)).toBe("4 guests");
  });

  test("who cancelled, and why when a reason was given", () => {
    expect(cancellationWords({ by: "CUSTOMER", reason: null })).toBe("Cancelled by the guest");
    expect(
      cancellationWords({ by: "RESTAURANT", reason: "We have a private event that evening." }),
    ).toBe("Cancelled by the restaurant: We have a private event that evening.");
    expect(cancellationWords({ by: null, reason: null })).toBe("Cancelled");
  });
});
