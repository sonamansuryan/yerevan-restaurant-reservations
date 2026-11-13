// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { guestPast, guestUpcoming } from "@/features/design/samples";
import type { BookedPlace } from "@/features/reservations/components/GuestBookings";
import { MyReservations } from "@/features/reservations/components/MyReservations";
import type {
  MyReservationsProps,
  ReservationListState,
  ReviewFlowState,
  VisitReviewState,
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
const LORIS_BUTTON = "Cancel reservation, Lori Smokehouse, Saturday 14 November, 19:00";

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

test("a card per booking, in order: the restaurant, how it stands, the day, time and party, then the table", () => {
  renderList();

  expect(screen.getAllByRole("heading", { level: 2 }).map((name) => name.textContent)).toEqual([
    "Sevan & Salt",
    "Lori Smokehouse",
    "Tsiran Wine Room",
    "Սարդարապատ ազգագրական ճաշարան",
  ]);
  const line = within(lineOf("Lori Smokehouse"));
  expect(line.getByText("Waiting for the restaurant")).toBeDefined();
  // The day and time are short on screen, and in full for screen readers.
  expect(line.getByText("Sat 14 Nov").getAttribute("aria-hidden")).toBe("true");
  expect(line.getByText("Saturday 14 November").className).toContain("sr-only");
  expect(line.getByText("19:00 to 21:00").className).toContain("sr-only");
  expect(line.getByText("2 guests")).toBeDefined();
  expect(line.getByText("Table T2 · Indoor · until 21:00")).toBeDefined();
  expect(lineOf("Lori Smokehouse").textContent).toContain(
    "Your note: A table by the window, please.",
  );
  expect(screen.getByRole("link", { name: "Lori Smokehouse" }).getAttribute("href")).toBe(
    "/restaurants/lori-smokehouse",
  );
});

test("a card leads with its restaurant's photo, and a table still to come offers directions", () => {
  const MAPS = "https://www.google.com/maps/search/?api=1&query=Lori%20Smokehouse";
  const places: Record<string, BookedPlace> = {
    "lori-smokehouse": {
      cover: "https://res.cloudinary.com/demo/image/upload/v1/lori.jpg",
      mapsUrl: MAPS,
    },
    "tsiran-wine-room": {
      cover: null,
      mapsUrl: "https://www.google.com/maps/search/?api=1&query=Tsiran",
    },
  };
  renderList({ placeFor: (slug) => places[slug] });

  // The photo is decoration: the card's heading names the restaurant.
  const photo = lineOf("Lori Smokehouse").querySelector("img");
  expect(photo?.getAttribute("alt")).toBe("");
  expect(photo?.getAttribute("src")).toBe(
    "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_400/v1/lori.jpg",
  );
  const directions = screen.getByRole("link", {
    name: "Directions to Lori Smokehouse, opens in a new tab",
  });
  expect(directions.getAttribute("href")).toBe(MAPS);
  expect(directions.getAttribute("target")).toBe("_blank");
  expect(directions.getAttribute("rel")).toBe("noopener noreferrer");
  // A cancelled table has nowhere to go. With no photo, or none known yet, a plain square stands in.
  expect(
    within(lineOf("Tsiran Wine Room")).queryByRole("link", { name: /^Directions/ }),
  ).toBeNull();
  expect(lineOf("Tsiran Wine Room").querySelector("img")).toBeNull();
  expect(lineOf("Sevan & Salt").querySelector("img")).toBeNull();
  expect(screen.getAllByRole("link", { name: /^Directions/ })).toHaveLength(1);
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
    screen
      .getAllByRole("button", { name: /^Cancel reservation,/ })
      .map((button) => button.ariaLabel),
  ).toEqual([
    "Cancel reservation, Sevan & Salt, Saturday 14 November, 13:00",
    LORIS_BUTTON,
    "Cancel reservation, Սարդարապատ ազգագրական ճաշարան, Saturday 28 November, 20:00",
  ]);
});

describe("cancelling", () => {
  test("it asks first, and Keep it changes nothing", async () => {
    const props = renderList();

    await userEvent.click(screen.getByRole("button", { name: LORIS_BUTTON }));

    const question = screen.getByRole("dialog", { name: "Cancel this reservation?" });
    expect(question.textContent).toContain(
      "Your table at Lori Smokehouse on Saturday 14 November at 19:00 will be offered to other guests.",
    );
    await userEvent.click(within(question).getByRole("button", { name: "Keep it" }));
    expect(props.onCancel).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("Cancel reservation in the question cancels that booking", async () => {
    const props = renderList();

    await userEvent.click(screen.getByRole("button", { name: LORIS_BUTTON }));
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel reservation" }),
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

test("once known, each list says how many bookings it holds", () => {
  renderList({ counts: { upcoming: 4, past: 12 } });

  const lists = within(screen.getByRole("navigation", { name: "Your reservations" }));
  expect(lists.getByRole("link", { name: "Upcoming (4)" }).getAttribute("aria-current")).toBe(
    "page",
  );
  expect(lists.getByRole("link", { name: "Past (12)" }).getAttribute("href")).toBe(
    "/reservations/past",
  );
});

test("Upcoming and Past are links, and the open one is marked", () => {
  renderList({ when: "past", list: loaded(guestPast) }, "/reservations/past");

  const lists = within(screen.getByRole("navigation", { name: "Your reservations" }));
  expect(lists.getByRole("link", { name: "Past" }).getAttribute("aria-current")).toBe("page");
  expect(lists.getByRole("link", { name: "Upcoming" }).getAttribute("href")).toBe("/reservations");
  expect(lists.getByRole("link", { name: "Upcoming" }).getAttribute("aria-current")).toBeNull();
});

test("past bookings say what happened, and a day from another year is read with its year", () => {
  renderList({ when: "past", list: loaded(guestPast) }, "/reservations/past");

  expect(lineOf("Kond House").textContent).toContain("Missed");
  expect(screen.getByText("Wednesday 31 December 2025")).toBeDefined();
  expect(screen.queryByRole("button", { name: /^Cancel reservation/ })).toBeNull();
});

test("a past day from another year shows its year on screen too, not only to screen readers", () => {
  renderList({ when: "past", list: loaded(guestPast) }, "/reservations/past");

  // The short date on screen sits beside the full one screen readers hear. "Wed 31 Dec" alone
  // could be any year's.
  const shown = screen.getByText("Wednesday 31 December 2025").previousElementSibling;
  expect(shown?.getAttribute("aria-hidden")).toBe("true");
  expect(shown?.textContent).toContain("2025");
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
    expect(within(dialog).getByRole("group", { name: "How was it?" })).toBeDefined();
  });

  test("Post review sends the rating as a number, with the words trimmed", async () => {
    const onPost = vi.fn();
    past({ review: noReview({ writing: visit, onPost }) });

    await userEvent.click(screen.getByRole("radio", { name: /Very good/ }));
    await userEvent.type(screen.getByLabelText("Your review"), "  Lovely terrace.  ");
    await userEvent.click(screen.getByRole("button", { name: "Post review" }));

    expect(onPost).toHaveBeenCalledWith({ rating: 4, comment: "Lovely terrace." });
  });

  test("Later closes the form", async () => {
    const onClose = vi.fn();
    past({ review: noReview({ writing: visit, onClose }) });

    await userEvent.click(screen.getByRole("button", { name: "Later" }));

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

describe("recently visited", () => {
  const latest = guestPast.find(({ id }) => id === "past-lori")!;
  const visitState = (change: Partial<VisitReviewState> = {}): VisitReviewState => ({
    booking: latest,
    sending: false,
    error: null,
    onPost: vi.fn(),
    onLater: vi.fn(),
    ...change,
  });

  test("under the upcoming list, the latest visit waits for a review, with the form in place", async () => {
    const visit = visitState();
    renderList({ visit });

    const section = screen.getByRole("region", { name: "Recently visited" });
    expect(within(section).getByText("Lori Smokehouse")).toBeDefined();
    expect(within(section).getByText("Fri 6 Nov · 20:00 · 2 guests")).toBeDefined();
    expect(within(section).getByText("Arrived")).toBeDefined();
    // The card above the form already says which visit it is.
    expect(within(section).queryByText(/^Your visit to/)).toBeNull();

    await userEvent.click(within(section).getByRole("radio", { name: "5 of 5, Excellent" }));
    await userEvent.click(within(section).getByRole("button", { name: "Post review" }));

    expect(visit.onPost).toHaveBeenCalledWith({ rating: 5 });
  });

  test("Later puts it away", async () => {
    const visit = visitState();
    renderList({ visit });

    await userEvent.click(screen.getByRole("button", { name: "Later" }));

    expect(visit.onLater).toHaveBeenCalledOnce();
    expect(visit.onPost).not.toHaveBeenCalled();
  });

  test("the Past list doesn't show it: its visits are reviewed from their own cards", () => {
    renderList(
      { when: "past", list: loaded(guestPast), visit: visitState() },
      "/reservations/past",
    );

    expect(screen.queryByRole("region", { name: "Recently visited" })).toBeNull();
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
