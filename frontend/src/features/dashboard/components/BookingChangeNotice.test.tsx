// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import { changeDoneWords } from "@/features/dashboard/bookingChanges";
import { BookingChangeNotice } from "@/features/dashboard/components/BookingChangeNotice";
import { fridayBookings } from "@/features/design/samples";
import { ApiError } from "@/lib/api";

afterEach(cleanup);

// Aram Khachatryan's booking at 19:30.
const aram = fridayBookings[3]!;

test("what each change did, said back", () => {
  expect(changeDoneWords({ ...aram, status: "CONFIRMED" })).toBe(
    "Aram Khachatryan’s booking at 19:30 is confirmed.",
  );
  expect(changeDoneWords({ ...aram, status: "ARRIVED" })).toBe(
    "Aram Khachatryan is marked as arrived.",
  );
  expect(changeDoneWords({ ...aram, status: "NO_SHOW" })).toBe(
    "Aram Khachatryan’s booking at 19:30 is marked as a no-show.",
  );
  expect(changeDoneWords({ ...aram, status: "CANCELLED" })).toBe(
    "Aram Khachatryan’s booking at 19:30 is cancelled.",
  );
});

test("a change made is said, and focus moves there, as its button has gone", () => {
  render(<BookingChangeNotice changed={{ ...aram, status: "CONFIRMED" }} refusal={null} />);

  const notice = screen.getByRole("status");
  expect(notice.textContent).toBe("Aram Khachatryan’s booking at 19:30 is confirmed.");
  expect(document.activeElement).toBe(notice.parentElement);
});

test("a refusal is said in the server's words, and focus moves there", () => {
  const refusal = new ApiError(
    409,
    "NO_SHOW_TOO_EARLY",
    "A guest can be marked as a no-show only after their booking starts.",
  );
  render(<BookingChangeNotice changed={null} refusal={refusal} />);

  const alert = screen.getByRole("alert");
  expect(alert.textContent).toBe(
    "A guest can be marked as a no-show only after their booking starts.",
  );
  expect(document.activeElement).toBe(alert.parentElement);
});

test("before any change, nothing is said", () => {
  const { container } = render(<BookingChangeNotice changed={null} refusal={null} />);

  expect(container.innerHTML).toBe("");
});
