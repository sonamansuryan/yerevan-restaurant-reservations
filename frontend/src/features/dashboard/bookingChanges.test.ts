import { describe, expect, test } from "vitest";

import { CHANGE_LABELS, CHANGE_ORDER, changeLabel } from "@/features/dashboard/bookingChanges";
import type { ReservationStatus } from "@/types/api";

const STATUSES: ReservationStatus[] = ["PENDING", "CONFIRMED", "ARRIVED", "NO_SHOW", "CANCELLED"];

describe("a change's button for one booking", () => {
  test("cancelling a booking still waiting to be confirmed is declining it", () => {
    expect(changeLabel("CANCELLED", "PENDING")).toBe("Decline");
  });

  test("cancelling any other booking is cancelling it", () => {
    expect(changeLabel("CANCELLED", "CONFIRMED")).toBe("Cancel");
    expect(changeLabel("CANCELLED", "ARRIVED")).toBe("Cancel");
  });

  test("every other change says what it does, whatever the booking is", () => {
    expect(changeLabel("CONFIRMED", "PENDING")).toBe("Confirm");
    expect(changeLabel("ARRIVED", "CONFIRMED")).toBe("Mark arrived");
    expect(changeLabel("NO_SHOW", "CONFIRMED")).toBe("Mark no-show");
    for (const change of CHANGE_ORDER.filter((one) => one !== "CANCELLED")) {
      for (const status of STATUSES) {
        expect(changeLabel(change, status), `${change} on ${status}`).toBe(CHANGE_LABELS[change]);
      }
    }
  });
});
