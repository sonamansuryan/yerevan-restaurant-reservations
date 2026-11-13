// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { guestPast, guestUpcoming } from "@/features/design/samples";
import { MyReservations } from "@/features/reservations/components/MyReservations";
import type {
  MyReservationsProps,
  ReservationListState,
  ReviewFlowState,
} from "@/features/reservations/components/MyReservations";
import { reservationsPath } from "@/features/reservations/reservations";
import { ApiError } from "@/lib/api";
import type { GuestReservation } from "@/types/api";

// jsdom has no showModal(), which Modal uses. These open and close it the simple way.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
});

afterEach(cleanup);

const TODAY = "2026-11-11";
const lori = guestUpcoming.find(({ id }) => id === "upcoming-lori")!;
const LORIS_BUTTON = "Cancel booking, Lori Smokehouse, Saturday 14 November, 19:00";

const loaded = (data: GuestReservation[], total = data.length): ReservationListState => ({
  data: { data, meta: { page: 1, pageSize: 20, total } },
  failed: false,
  retrying: false,
  onRetry: vi.fn(),
});

/** No review being written, and none just posted. */
const noReview = (change: Partial<ReviewFlowState> = {}): ReviewFlowState => ({
  writing: null,
  sending: false,
  error: null,
  posted: null,
  onWrite: vi.fn(),
  onClose: vi.fn(),
  onPost: vi.fn(),
  ...change,
});

function renderList(change: Partial<MyReservationsProps> = {}, at = "/reservations") {
  const props: MyReservationsProps = {
    when: "upcoming",
    page: 1,
    today: TODAY,
    list: loaded(guestUpcoming),
    hrefFor: reservationsPath,
    cancellingId: null,
    cancelled: null,
    refusal: null,
    onCancel: vi.fn(),
    review: noReview(),
    onFindATable: vi.fn(),
    onFirstPage: vi.fn(),
    ...change,
  };
  render(
    <MemoryRouter initialEntries={[at]}>
      <MyReservations {...props} />
    </MemoryRouter>,
  );
  return props;
}

/** The line of the booking at this restaurant. */
const lineOf = (name: string): HTMLElement =>
  screen.getByRole("link", { name }).closest("li") as HTMLElement;

test("each day under its name, then a line per booking: the time, the restaurant, the table and party, the status", () => {
  renderList();

  expect(screen.getAllByRole("heading", { level: 2 }).map((day) => day.textContent)).toEqual([
    "Saturday 14 November",
    "Friday 20 November",
    "Saturday 28 November",
  ]);
  const line = lineOf("Lori Smokehouse");
  expect(within(line).getByText("19:00 to 21:00")).toBeDefined();
  expect(line.textContent).toContain("Table T2 · Indoor · 2 guests");
  expect(line.textContent).toContain("Waiting for the restaurant");
  expect(line.textContent).toContain("Your note: A table by the window, please.");
  expect(screen.getByRole("link", { name: "Lori Smokehouse" }).getAttribute("href")).toBe(
    "/restaurants/lori-smokehouse",
  );
});

test("a cancelled booking stays, crossed out, with who cancelled it and why, and can't be cancelled", () => {
  renderList();

  const line = lineOf("Tsiran Wine Room");
  expect(line.textContent).toContain(
    "Cancelled by the restaurant: We’re closed for a private event that night.",
  );
  expect(line.querySelector(".line-through")).not.toBeNull();
  expect(within(line).queryByRole("button")).toBeNull();
});

test("only bookings that can still be cancelled offer to, each named in full", () => {
  renderList();

  expect(
    screen.getAllByRole("button", { name: /^Cancel booking,/ }).map((button) => button.ariaLabel),
  ).toEqual([
    "Cancel booking, Sevan & Salt, Saturday 14 November, 13:00",
    LORIS_BUTTON,
    "Cancel booking, Սարդարապատ ազգագրական ճաշարան, Saturday 28 November, 20:00",
  ]);
});

describe("cancelling", () => {
  test("it asks first, and Keep it changes nothing", async () => {
    const props = renderList();

    await userEvent.click(screen.getByRole("button", { name: LORIS_BUTTON }));

    const question = screen.getByRole("dialog", { name: "Cancel this booking?" });
    expect(question.textContent).toContain(
      "Your table at Lori Smokehouse on Saturday 14 November at 19:00 will be offered to other guests.",
    );
    await userEvent.click(within(question).getByRole("button", { name: "Keep it" }));
    expect(props.onCancel).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("Cancel booking in the question cancels that booking", async () => {
    const props = renderList();

    await userEvent.click(screen.getByRole("button", { name: LORIS_BUTTON }));
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel booking" }),
    );

    expect(props.onCancel).toHaveBeenCalledWith(lori);
  });

  test("while it's sent, that booking's button waits", () => {
    renderList({ cancellingId: lori.id });

    expect(screen.getByRole("button", { name: LORIS_BUTTON }).getAttribute("aria-busy")).toBe(
      "true",
    );
  });

  test("once cancelled, it says so, and focus moves there", () => {
    renderList({
      cancelled: { ...lori, status: "CANCELLED", canCancel: false },
    });

    const notice = screen.getByRole("status");
    expect(notice.textContent).toBe(
      "Your booking at Lori Smokehouse on Saturday 14 November is cancelled.",
    );
    expect(document.activeElement).toBe(notice.parentElement);
  });

  test("a refusal is said in the server's words, and focus moves there", () => {
    renderList({
      refusal: new ApiError(
        409,
        "CANCEL_TOO_LATE",
        "This booking has already started, so it can’t be cancelled.",
      ),
    });

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("This booking has already started, so it can’t be cancelled.");
    expect(document.activeElement).toBe(alert.parentElement);
  });
});

test("Upcoming and Past are links, and the open one is marked", () => {
  renderList({ when: "past", list: loaded(guestPast) }, "/reservations/past");

  const lists = within(screen.getByRole("navigation", { name: "Your reservations" }));
  expect(lists.getByRole("link", { name: "Past" }).getAttribute("aria-current")).toBe("page");
  expect(lists.getByRole("link", { name: "Upcoming" }).getAttribute("href")).toBe("/reservations");
  expect(lists.getByRole("link", { name: "Upcoming" }).getAttribute("aria-current")).toBeNull();
});

test("past bookings: what happened, and a day from another year with its year", () => {
  renderList({ when: "past", list: loaded(guestPast) }, "/reservations/past");

  expect(lineOf("Kond House").textContent).toContain("Missed");
  expect(screen.getAllByRole("heading", { level: 2 }).at(-1)?.textContent).toBe(
    "Wednesday 31 December 2025",
  );
  expect(screen.queryByRole("button", { name: /^Cancel booking/ })).toBeNull();
});

describe("reviewing a visit", () => {
  const visit = guestPast.find(({ id }) => id === "past-lori")!;
  const REVIEW_BUTTON = "Review your visit, Lori Smokehouse, Friday 6 November, 20:00";
  const past = (change: Partial<MyReservationsProps> = {}) =>
    renderList({ when: "past", list: loaded(guestPast), ...change }, "/reservations/past");

  test("only a visit marked arrived and not reviewed yet offers it, named in full", async () => {
    const onWrite = vi.fn();
    past({ review: noReview({ onWrite }) });

    const buttons = screen.getAllByRole("button", { name: /^Review your visit/ });
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([REVIEW_BUTTON]);
    await userEvent.click(buttons[0]!);
    expect(onWrite).toHaveBeenCalledWith(visit);
  });

  test("a visit already reviewed shows the guest's review instead", () => {
    past();

    const reviewed = screen.getByText(/^Your review:/).closest("p");
    expect(reviewed?.textContent).toBe(
      "Your review: 5 out of 5. The best table for New Year’s Eve, and the trout was perfect.",
    );
  });

  test("the form opens over the page, for that visit", () => {
    past({ review: noReview({ writing: visit }) });

    const dialog = screen.getByRole("dialog", { name: "Review your visit" });
    expect(dialog.textContent).toContain("Your visit to Lori Smokehouse on Friday 6 November.");
    expect(within(dialog).getByRole("group", { name: "Your rating" })).toBeDefined();
  });

  test("Post review sends the rating as a number, with the words trimmed", async () => {
    const onPost = vi.fn();
    past({ review: noReview({ writing: visit, onPost }) });

    await userEvent.click(screen.getByRole("radio", { name: /Very good/ }));
    await userEvent.type(screen.getByLabelText("Your review"), "  Lovely terrace.  ");
    await userEvent.click(screen.getByRole("button", { name: "Post review" }));

    expect(onPost).toHaveBeenCalledWith({ rating: 4, comment: "Lovely terrace." });
  });

  test("Not now closes the form", async () => {
    const onClose = vi.fn();
    past({ review: noReview({ writing: visit, onClose }) });

    await userEvent.click(screen.getByRole("button", { name: "Not now" }));

    expect(onClose).toHaveBeenCalled();
  });

  test("a refusal shows in the form, which stays open", () => {
    past({
      review: noReview({
        writing: visit,
        error: new ApiError(409, "ALREADY_REVIEWED", "You’ve already reviewed this visit."),
      }),
    });

    const dialog = screen.getByRole("dialog", { name: "Review your visit" });
    expect(within(dialog).getByRole("alert").textContent).toBe(
      "You’ve already reviewed this visit.",
    );
  });

  test("once posted, it says thank you, and focus moves there", () => {
    past({ review: noReview({ posted: visit }) });

    const notice = screen.getByText("Thank you. Your review of Lori Smokehouse is posted.");
    expect(notice.closest("[role=status]")).not.toBeNull();
    expect(document.activeElement?.contains(notice)).toBe(true);
  });
});

test("more than a page: the next one is a link", () => {
  renderList({ when: "past", list: loaded(guestPast, 24) }, "/reservations/past");

  expect(screen.getByText("Page 1 of 2")).toBeDefined();
  expect(screen.getByRole("link", { name: "Next" }).getAttribute("href")).toBe(
    "/reservations/past?page=2",
  );
});

describe("nothing to list", () => {
  test("no upcoming bookings: one clear next step, finding a table", async () => {
    const props = renderList({ list: loaded([]) });

    expect(screen.getByText("No upcoming reservations")).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Find a table" }));
    expect(props.onFindATable).toHaveBeenCalledOnce();
  });

  test("no past bookings", () => {
    renderList({ when: "past", list: loaded([]) }, "/reservations/past");

    expect(screen.getByText("No past reservations")).toBeDefined();
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("past the last page: how many are on earlier pages, and the way back", async () => {
    const props = renderList(
      { when: "past", page: 3, list: loaded([], 24) },
      "/reservations/past?page=3",
    );

    expect(screen.getByText("There are 24 bookings on earlier pages.")).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Go to the first page" }));
    expect(props.onFirstPage).toHaveBeenCalledOnce();
  });
});

test("while the list loads, and when it can't", async () => {
  renderList({ list: { data: undefined, failed: false, retrying: false, onRetry: vi.fn() } });
  expect(screen.getByRole("status", { name: "Loading your reservations" })).toBeDefined();
  cleanup();

  const onRetry = vi.fn();
  renderList({ list: { data: undefined, failed: true, retrying: false, onRetry } });
  expect(screen.getByText("We couldn’t load your reservations.")).toBeDefined();
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(onRetry).toHaveBeenCalledOnce();
});
