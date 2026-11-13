// @vitest-environment jsdom
// My reservations, through the real routes, guard, shell and hooks, with a fake API.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Mock } from "vitest";

import {
  armenianName,
  guestPast,
  guestUpcoming,
  sampleRestaurants,
} from "@/features/design/samples";
import { routes } from "@/router";
import type { AuthUser, GuestReservation, RestaurantDetail, RestaurantSummary } from "@/types/api";

type TestRouter = ReturnType<typeof createMemoryRouter>;

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status });

const lilit: AuthUser = {
  id: "user-lilit",
  email: "lilit@example.com",
  name: "Lilit Harutyunyan",
  phone: null,
  role: "CUSTOMER",
};
const ani: AuthUser = { ...lilit, id: "user-ani", name: "Ani Sargsyan", role: "OWNER" };

const lori = guestUpcoming.find(({ id }) => id === "upcoming-lori")!;
const loriCancelled: GuestReservation = {
  ...lori,
  status: "CANCELLED",
  cancellation: { by: "CUSTOMER", reason: null },
  canCancel: false,
};
const LORIS_BUTTON = "Cancel reservation, Lori Smokehouse, Saturday 14 November, 19:00";
const lastFriday = guestPast.find(({ id }) => id === "past-lori")!;

// The restaurants Lilit has booked, whose pages give her cards their directions.
const booked: RestaurantSummary[] = [...sampleRestaurants, armenianName];
const mapsUrlOf = (slug: string): string =>
  `https://www.google.com/maps/search/?api=1&query=${slug}`;

/** A restaurant's page, as GET /api/restaurants/:slug answers it. */
function detailOf(summary: RestaurantSummary): RestaurantDetail {
  return {
    ...summary,
    phone: null,
    website: null,
    photos: [],
    openingHours: [],
    osmUrl: null,
    mapsUrl: mapsUrlOf(summary.slug),
    mapImageUrl: null,
  };
}

interface FakeOptions {
  user?: AuthUser;
  /** What cancelling answers, if not a success. */
  refusal?: () => Response;
  /** What posting a review answers, if not a success. */
  reviewRefusal?: () => Response;
  /** The restaurants the guest has saved. Five, unless told. */
  saved?: RestaurantSummary[];
}

/**
 * The API, for a signed-in user. A cancel or a review that succeeds shows in the lists asked for
 * after it. Each booked restaurant's page answers, and so do the guest's favorites.
 */
function fakeApi({
  user = lilit,
  refusal,
  reviewRefusal,
  saved = sampleRestaurants.slice(0, 5),
}: FakeOptions = {}): Mock {
  let upcoming = guestUpcoming;
  let past = guestPast;
  const fetch = vi.fn((url: string, init?: RequestInit) => {
    if (url === "/api/me") return Promise.resolve(json({ user }));
    const slug = /^\/api\/restaurants\/([^/?]+)$/.exec(url)?.[1];
    const restaurant = booked.find((one) => one.slug === slug);
    if (restaurant) return Promise.resolve(json({ restaurant: detailOf(restaurant) }));
    if (url === "/api/favorites") {
      return Promise.resolve(
        json({ data: saved, meta: { page: 1, pageSize: 12, total: saved.length } }),
      );
    }
    if (url.startsWith("/api/reservations?")) {
      const query = new URLSearchParams(url.split("?")[1]);
      const data = query.get("when") === "past" ? past : upcoming;
      const page = Number(query.get("page"));
      return Promise.resolve(json({ data, meta: { page, pageSize: 20, total: data.length } }));
    }
    if (url === `/api/reservations/${lori.id}` && init?.method === "PATCH") {
      if (refusal) return Promise.resolve(refusal());
      upcoming = upcoming.map((one) => (one.id === lori.id ? loriCancelled : one));
      return Promise.resolve(json({ reservation: loriCancelled }));
    }
    if (url === `/api/reservations/${lastFriday.id}/review` && init?.method === "POST") {
      if (reviewRefusal) return Promise.resolve(reviewRefusal());
      const { rating, comment = null } = JSON.parse(String(init.body)) as {
        rating: number;
        comment?: string;
      };
      past = past.map((one) =>
        one.id === lastFriday.id ? { ...one, review: { rating, comment }, canReview: false } : one,
      );
      return Promise.resolve(
        json(
          { review: { id: "review-new", rating, comment, createdAt: "2026-11-11T10:00:00.000Z" } },
          201,
        ),
      );
    }
    return new Promise(() => {});
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const listRequests = (fetch: Mock): string[] =>
  fetch.mock.calls
    .map(([url]) => String(url))
    .filter((url) => url.startsWith("/api/reservations?"));

/** The requests for one of the two lists. */
const asked = (fetch: Mock, when: "upcoming" | "past"): string[] =>
  listRequests(fetch).filter((url) => url.includes(`when=${when}`));

const requests = (fetch: Mock): string[] => fetch.mock.calls.map(([url]) => String(url));

beforeEach(() => {
  // jsdom has no scrollTo(), which ScrollRestoration calls, and no showModal(), which Modal uses.
  window.scrollTo = vi.fn();
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderAt(path: string): TestRouter {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const main = (): ReturnType<typeof within> => within(screen.getByRole("main"));

test("a guest sees their upcoming bookings, and Past shows the ones that are over", async () => {
  const fetch = fakeApi();
  const router = renderAt("/reservations");

  expect(await main().findByRole("link", { name: "Lori Smokehouse" })).toBeDefined();
  expect(document.title).toBe("My reservations · Seghan");
  // Each tab counts its list, so the other list's first page is asked for too.
  const tabs = within(main().getByRole("navigation", { name: "Your reservations" }));
  expect(await tabs.findByRole("link", { name: "Past (4)" })).toBeDefined();
  expect(tabs.getByRole("link", { name: "Upcoming (4)" }).getAttribute("aria-current")).toBe(
    "page",
  );
  expect(listRequests(fetch)).toEqual([
    "/api/reservations?when=upcoming&page=1",
    "/api/reservations?when=past&page=1",
  ]);

  await userEvent.click(tabs.getByRole("link", { name: "Past (4)" }));

  expect(await main().findByRole("link", { name: "Kond House" })).toBeDefined();
  expect(router.state.location.pathname).toBe("/reservations/past");
  expect(document.title).toBe("Past reservations · Seghan");
  // Whichever tab is open, only the two lists' first pages are asked for.
  expect([...new Set(listRequests(fetch))].sort()).toEqual([
    "/api/reservations?when=past&page=1",
    "/api/reservations?when=upcoming&page=1",
  ]);
});

test("the page comes from the address", async () => {
  const fetch = fakeApi();
  renderAt("/reservations/past?page=2");

  await waitFor(() =>
    expect(listRequests(fetch)).toEqual([
      "/api/reservations?when=past&page=2",
      // The other list's first page, for its count on its tab.
      "/api/reservations?when=upcoming&page=1",
    ]),
  );
});

test("each booking is a card under its restaurant's name: the day, the time, the party and the table", async () => {
  fakeApi();
  renderAt("/reservations");

  const name = await main().findByRole("heading", { level: 2, name: "Lori Smokehouse" });
  const card = name.closest("li") as HTMLElement;

  expect(within(name).getByRole("link").getAttribute("href")).toBe("/restaurants/lori-smokehouse");
  // The short day and time are for the eye. Screen readers hear the whole day, and the end.
  expect(within(card).getByText("Saturday 14 November").className).toContain("sr-only");
  expect(within(card).getByText("19:00 to 21:00").className).toContain("sr-only");
  expect(within(card).getByText("2 guests")).toBeDefined();
  expect(within(card).getByText("Table T2 · Indoor · until 21:00")).toBeDefined();
  // The cards follow one another, with no day headings between them.
  expect(main().queryByRole("heading", { name: "Saturday 14 November" })).toBeNull();
});

test("a booking still to come has directions, which open its map in a new tab", async () => {
  const fetch = fakeApi();
  renderAt("/reservations");

  const directions = await main().findByRole("link", {
    name: "Directions to Lori Smokehouse, opens in a new tab",
  });

  expect(directions.getAttribute("href")).toBe(mapsUrlOf("lori-smokehouse"));
  expect(directions.getAttribute("target")).toBe("_blank");
  expect(directions.getAttribute("rel")).toBe("noopener noreferrer");
  expect(requests(fetch)).toContain("/api/restaurants/lori-smokehouse");
  // A cancelled booking has nowhere to go.
  const tsiran = main()
    .getByRole("heading", { name: "Tsiran Wine Room" })
    .closest("li") as HTMLElement;
  expect(within(tsiran).queryByRole("link", { name: /^Directions/ })).toBeNull();
});

test("beside the bookings are the first four restaurants the guest saved, and the way to all of them", async () => {
  const fetch = fakeApi();
  renderAt("/reservations");

  const saved = await main().findByRole("complementary", { name: "Saved restaurants" });
  const all = await within(saved).findByRole("link", { name: "See all 5" });

  expect(all.getAttribute("href")).toBe("/favorites");
  expect(
    within(saved)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href")),
  ).toEqual([
    "/restaurants/kond-house",
    "/restaurants/lori-smokehouse",
    "/restaurants/nurr",
    "/restaurants/sevan-and-salt",
    "/favorites",
  ]);
  expect(requests(fetch)).toContain("/api/favorites");
});

describe("cancelling", () => {
  test("asked and confirmed, it's sent, the list is asked for again, and the guest is told", async () => {
    const fetch = fakeApi();
    renderAt("/reservations");

    await userEvent.click(await main().findByRole("button", { name: LORIS_BUTTON }));
    const question = within(screen.getByRole("dialog", { name: "Cancel this reservation?" }));
    await userEvent.click(question.getByRole("button", { name: "Cancel reservation" }));

    expect((await main().findByRole("status")).textContent).toBe(
      "Your booking at Lori Smokehouse on Saturday 14 November is cancelled.",
    );
    const sent = fetch.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(sent?.[0]).toBe(`/api/reservations/${lori.id}`);
    expect(JSON.parse(String(sent?.[1]?.body))).toEqual({ status: "CANCELLED" });
    // Asked for again, it shows the booking crossed out, with no button left to press.
    await waitFor(() => expect(main().queryByRole("button", { name: LORIS_BUTTON })).toBeNull());
    expect(
      main().getByRole("link", { name: "Lori Smokehouse" }).closest("li")?.textContent,
    ).toContain("Cancelled by you");
  });

  test("refused, the server's reason is shown, and the list is asked for again", async () => {
    const fetch = fakeApi({
      refusal: () =>
        json(
          {
            error: {
              code: "CANCEL_TOO_LATE",
              message: "This booking has already started, so it can’t be cancelled.",
            },
          },
          409,
        ),
    });
    renderAt("/reservations");

    await userEvent.click(await main().findByRole("button", { name: LORIS_BUTTON }));
    const question = within(screen.getByRole("dialog", { name: "Cancel this reservation?" }));
    await userEvent.click(question.getByRole("button", { name: "Cancel reservation" }));

    expect((await main().findByRole("alert")).textContent).toBe(
      "This booking has already started, so it can’t be cancelled.",
    );
    await waitFor(() => expect(asked(fetch, "upcoming")).toHaveLength(2));
  });

  test("Keep it closes the question, and nothing is sent", async () => {
    const fetch = fakeApi();
    renderAt("/reservations");

    await userEvent.click(await main().findByRole("button", { name: LORIS_BUTTON }));
    const question = screen.getByRole("dialog", { name: "Cancel this reservation?" });
    await userEvent.click(within(question).getByRole("button", { name: "Keep it" }));

    expect((question as HTMLDialogElement).open).toBe(false);
    expect(fetch.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
    expect(main().getByRole("button", { name: LORIS_BUTTON })).toBeDefined();
  });
});

describe("reviewing a visit", () => {
  const REVIEW_BUTTON = "Review your visit, Lori Smokehouse, Friday 6 November, 20:00";

  test("on Upcoming, the latest visit to review waits under Recently visited, rated in stars", async () => {
    const fetch = fakeApi();
    renderAt("/reservations");

    const visited = await main().findByRole("region", { name: "Recently visited" });
    expect(within(visited).getByText("Lori Smokehouse")).toBeDefined();
    const stars = within(visited).getByRole("group", { name: "How was it?" });
    expect(
      within(stars)
        .getAllByRole("radio")
        .map((star) => star.getAttribute("aria-label")),
    ).toEqual([
      "1 of 5, Poor",
      "2 of 5, Fair",
      "3 of 5, Good",
      "4 of 5, Very good",
      "5 of 5, Excellent",
    ]);
    await userEvent.click(within(stars).getByRole("radio", { name: "5 of 5, Excellent" }));
    await userEvent.click(within(visited).getByRole("button", { name: "Post review" }));

    expect((await main().findByRole("status")).textContent).toBe(
      "Thank you. Your review of Lori Smokehouse is posted.",
    );
    const sent = fetch.mock.calls.find(([, init]) => init?.method === "POST");
    expect(sent?.[0]).toBe(`/api/reservations/${lastFriday.id}/review`);
    expect(JSON.parse(String(sent?.[1]?.body))).toEqual({ rating: 5 });
    // Reviewed, the visit asks for nothing more, and no other visit waits.
    await waitFor(() =>
      expect(main().queryByRole("region", { name: "Recently visited" })).toBeNull(),
    );
  });

  test("Later puts the visit away, and nothing is sent", async () => {
    const fetch = fakeApi();
    renderAt("/reservations");

    const visited = await main().findByRole("region", { name: "Recently visited" });
    await userEvent.click(within(visited).getByRole("button", { name: "Later" }));

    expect(main().queryByRole("region", { name: "Recently visited" })).toBeNull();
    expect(fetch.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  test("rated and sent, the form closes, the guest is thanked, and the visit shows the review", async () => {
    const fetch = fakeApi();
    renderAt("/reservations/past");

    await userEvent.click(await main().findByRole("button", { name: REVIEW_BUTTON }));
    const form = within(screen.getByRole("dialog", { name: "Review your visit" }));
    await userEvent.click(form.getByRole("radio", { name: /Very good/ }));
    await userEvent.type(form.getByLabelText("Your review"), "A warm room.");
    await userEvent.click(form.getByRole("button", { name: "Post review" }));

    expect((await main().findByRole("status")).textContent).toBe(
      "Thank you. Your review of Lori Smokehouse is posted.",
    );
    const sent = fetch.mock.calls.find(([, init]) => init?.method === "POST");
    expect(sent?.[0]).toBe(`/api/reservations/${lastFriday.id}/review`);
    expect(JSON.parse(String(sent?.[1]?.body))).toEqual({ rating: 4, comment: "A warm room." });
    expect(screen.queryByRole("dialog")).toBeNull();
    // Asked for again, the visit shows the review, with no button left to press.
    await waitFor(() => expect(main().queryByRole("button", { name: REVIEW_BUTTON })).toBeNull());
    const reviews = main()
      .getAllByText("Your review:")
      .map((label: HTMLElement) => label.closest("p")?.textContent);
    expect(reviews).toContain("Your review: 4 out of 5. A warm room.");
  });

  test("refused, the form stays open with the server's reason, and the list is asked for again", async () => {
    const fetch = fakeApi({
      reviewRefusal: () =>
        json(
          { error: { code: "ALREADY_REVIEWED", message: "You’ve already reviewed this visit." } },
          409,
        ),
    });
    renderAt("/reservations/past");

    await userEvent.click(await main().findByRole("button", { name: REVIEW_BUTTON }));
    const form = within(screen.getByRole("dialog", { name: "Review your visit" }));
    await userEvent.click(form.getByRole("radio", { name: /Excellent/ }));
    await userEvent.click(form.getByRole("button", { name: "Post review" }));

    expect((await form.findByRole("alert")).textContent).toBe(
      "You’ve already reviewed this visit.",
    );
    expect(form.getByRole<HTMLInputElement>("radio", { name: /Excellent/ }).checked).toBe(true);
    await waitFor(() => expect(asked(fetch, "past")).toHaveLength(2));
  });
});

test("one guest signs out and another signs in: the first one's bookings never show, not even while the new ones load", async () => {
  const aram: AuthUser = {
    ...lilit,
    id: "user-aram",
    email: "aram@example.com",
    name: "Aram Petrosyan",
  };
  let user: AuthUser | null = lilit;
  const fetch = vi.fn((url: string) => {
    if (url === "/api/me") {
      return Promise.resolve(
        user
          ? json({ user })
          : json({ error: { code: "UNAUTHORIZED", message: "Please sign in." } }, 401),
      );
    }
    if (url === "/api/auth/refresh") {
      return Promise.resolve(
        json({ error: { code: "UNAUTHORIZED", message: "Please sign in." } }, 401),
      );
    }
    if (url === "/api/auth/logout") {
      user = null;
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    if (url === "/api/auth/login") {
      user = aram;
      return Promise.resolve(json({ user: aram }));
    }
    if (url.startsWith("/api/reservations?") && user === lilit) {
      return Promise.resolve(
        json({ data: guestUpcoming, meta: { page: 1, pageSize: 20, total: guestUpcoming.length } }),
      );
    }
    // Aram's own bookings are still on their way, which is when a cached copy would show.
    return new Promise(() => {});
  });
  vi.stubGlobal("fetch", fetch);
  renderAt("/reservations");
  expect(await main().findByRole("link", { name: "Lori Smokehouse" })).toBeDefined();

  await userEvent.click(
    within(screen.getByRole("banner")).getByRole("button", { name: "Sign out" }),
  );
  await userEvent.click(
    await within(screen.getByRole("banner")).findByRole("link", { name: "Sign in" }),
  );
  await userEvent.type(await main().findByLabelText("Email"), "aram@example.com");
  await userEvent.type(main().getByLabelText("Password"), "a long password");
  await userEvent.click(main().getByRole("button", { name: "Sign in" }));
  // Sign in has no site header of its own, so the links are there once home opens.
  const links = within(await screen.findByRole("navigation", { name: "Main" }));
  await userEvent.click(await links.findByRole("link", { name: "My reservations" }));

  expect(await main().findByRole("status", { name: "Loading your reservations" })).toBeDefined();
  expect(main().queryByRole("link", { name: "Lori Smokehouse" })).toBeNull();
  // Lilit's two lists, then Aram's two, still on their way.
  expect(
    fetch.mock.calls.filter(([url]) => String(url).startsWith("/api/reservations?")),
  ).toHaveLength(4);
});

test("an owner is told the page is for guests, and nothing is asked for", async () => {
  const fetch = fakeApi({ user: ani });
  renderAt("/reservations");

  await waitFor(() => expect(document.title).toBe("This page is for guests · Seghan"));
  expect(listRequests(fetch)).toEqual([]);
});
