import { describe, expect, test } from "vitest";

import {
  cancellationWords,
  dayFigures,
  dayHoursWords,
  GUEST_STATUS_TONES,
  guestsWords,
  STATUS_TONES,
} from "@/features/dashboard/labels";
import { fridayBookings } from "@/features/design/samples";
import type { OpeningHours } from "@/types/api";

describe("a day's bookings in words", () => {
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

describe("the day at a glance", () => {
  test("the guests expected, those to confirm, those seated and the no-shows", () => {
    // Arrived 2, confirmed 4 and 2, pending 6. The no-show and the cancelled table aren't expected.
    expect(dayFigures(fridayBookings, true)).toEqual([
      { label: "Guests expected", value: "14", note: "not counting cancellations" },
      { label: "To confirm", value: "1", note: "waiting for you" },
      { label: "Seated", value: "1", note: "of 6 bookings" },
      { label: "No-shows", value: "1", note: "today" },
    ]);
  });

  test("one booking is one, and a day that isn't today is that day", () => {
    // Lilit's lunch for two, marked arrived.
    const lunch = fridayBookings.slice(0, 1);

    expect(dayFigures(lunch, false)).toEqual([
      { label: "Guests expected", value: "2", note: "not counting cancellations" },
      { label: "To confirm", value: "0", note: "waiting for you" },
      { label: "Seated", value: "1", note: "of 1 booking" },
      { label: "No-shows", value: "0", note: "that day" },
    ]);
  });

  test("cancelled parties and no-shows aren't expected", () => {
    const gone = fridayBookings.filter(
      (booking) => booking.status === "CANCELLED" || booking.status === "NO_SHOW",
    );

    expect(dayFigures(gone, true)[0]).toEqual({
      label: "Guests expected",
      value: "0",
      note: "not counting cancellations",
    });
  });

  test("a day with no bookings counts nothing", () => {
    expect(dayFigures([], true).map(({ value, note }) => [value, note])).toEqual([
      ["0", "not counting cancellations"],
      ["0", "waiting for you"],
      ["0", "of 0 bookings"],
      ["0", "today"],
    ]);
  });
});

describe("a day's opening hours in words", () => {
  const MONDAY = 1;
  const FRIDAY = 5;

  const shift = (
    dayOfWeek: number,
    [opensAt, opens]: [number, string],
    [closesAt, closes]: [number, string],
  ): OpeningHours => ({ dayOfWeek, opensAt, closesAt, opens, closes });

  const lunch = shift(FRIDAY, [720, "12:00"], [900, "15:00"]);
  const dinner = shift(FRIDAY, [1080, "18:00"], [1380, "23:00"]);

  test("a day without hours is closed", () => {
    expect(dayHoursWords([lunch, dinner], MONDAY)).toBe("Closed");
    expect(dayHoursWords([], FRIDAY)).toBe("Closed");
  });

  test("one opening, from when to when", () => {
    expect(dayHoursWords([shift(FRIDAY, [720, "12:00"], [1380, "23:00"])], FRIDAY)).toBe(
      "Open 12:00 – 23:00",
    );
  });

  test("split shifts, earliest first, whatever order they come in", () => {
    expect(dayHoursWords([dinner, lunch], FRIDAY)).toBe("Open 12:00 – 15:00, 18:00 – 23:00");
  });

  test("a late night keeps its closing time", () => {
    expect(dayHoursWords([shift(FRIDAY, [1080, "18:00"], [1560, "02:00"])], FRIDAY)).toBe(
      "Open 18:00 – 02:00",
    );
  });
});

test("each status has its color, for the restaurant and for the guest", () => {
  // The restaurant's: waiting in amber, confirmed in blue, seated in green.
  expect(STATUS_TONES).toEqual({
    PENDING: "warning",
    CONFIRMED: "info",
    ARRIVED: "success",
    NO_SHOW: "neutral",
    CANCELLED: "error",
  });
  // The guest's: a confirmed table is the good news, and a visit that's over is grey.
  expect(GUEST_STATUS_TONES).toEqual({
    PENDING: "warning",
    CONFIRMED: "success",
    ARRIVED: "neutral",
    NO_SHOW: "neutral",
    CANCELLED: "error",
  });
});
