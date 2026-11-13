import { expect, test } from "vitest";

import {
  bookingsWords,
  guestCancellationWords,
  pageFrom,
  reservationsPath,
} from "@/features/reservations/reservations";

test("each list has its own address, and pages after the first are in the query", () => {
  expect(reservationsPath("upcoming")).toBe("/reservations");
  expect(reservationsPath("past")).toBe("/reservations/past");
  expect(reservationsPath("past", 1)).toBe("/reservations/past");
  expect(reservationsPath("upcoming", 3)).toBe("/reservations?page=3");
});

test("the page in the address is a whole number from 1, or else the first", () => {
  const at = (query: string): number => pageFrom(new URLSearchParams(query));

  expect(at("page=2")).toBe(2);
  for (const query of ["", "page=", "page=0", "page=-1", "page=1.5", "page=two"]) {
    expect(at(query), query).toBe(1);
  }
});

test("a cancellation says who cancelled, from the guest's side, with the restaurant's reason", () => {
  expect(guestCancellationWords({ by: "CUSTOMER", reason: null })).toBe("Cancelled by you");
  expect(guestCancellationWords({ by: "RESTAURANT", reason: "We’re closed tonight." })).toBe(
    "Cancelled by the restaurant: We’re closed tonight.",
  );
  expect(guestCancellationWords({ by: "RESTAURANT", reason: null })).toBe(
    "Cancelled by the restaurant",
  );
  expect(guestCancellationWords({ by: null, reason: null })).toBe("Cancelled");
});

test("bookings are counted in words", () => {
  expect(bookingsWords(1)).toBe("1 booking");
  expect(bookingsWords(24)).toBe("24 bookings");
});
