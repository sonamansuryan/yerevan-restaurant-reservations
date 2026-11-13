// @vitest-environment jsdom
// My reservations, through the real routes, guard, shell and hooks, with a fake API.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Mock } from "vitest";

import { guestPast, guestUpcoming } from "@/features/design/samples";
import { routes } from "@/router";
import type { AuthUser, GuestReservation } from "@/types/api";

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
const LORIS_BUTTON = "Cancel booking, Lori Smokehouse, Saturday 14 November, 19:00";
const lastFriday = guestPast.find(({ id }) => id === "past-lori")!;

interface FakeOptions {
  user?: AuthUser;
  /** What cancelling answers, if not a success. */
  refusal?: () => Response;
  /** What posting a review answers, if not a success. */
  reviewRefusal?: () => Response;
}

/**
 * The API, for a signed-in user. A cancel or a review that succeeds shows in the lists asked for
 * after it.
 */
function fakeApi({ user = lilit, refusal, reviewRefusal }: FakeOptions = {}): Mock {
  let upcoming = guestUpcoming;
  let past = guestPast;
  const fetch = vi.fn((url: string, init?: RequestInit) => {
    if (url === "/api/me") return Promise.resolve(json({ user }));
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

  await userEvent.click(main().getByRole("link", { name: "Past" }));

  expect(await main().findByRole("link", { name: "Kond House" })).toBeDefined();
  expect(router.state.location.pathname).toBe("/reservations/past");
  expect(document.title).toBe("Past reservations · Seghan");
  expect(listRequests(fetch)).toEqual([
    "/api/reservations?when=upcoming&page=1",
    "/api/reservations?when=past&page=1",
  ]);
});

test("the page comes from the address", async () => {
  const fetch = fakeApi();
  renderAt("/reservations/past?page=2");

  await waitFor(() => expect(listRequests(fetch)).toEqual(["/api/reservations?when=past&page=2"]));
});

describe("cancelling", () => {
  test("asked and confirmed, it's sent, the list is asked for again, and the guest is told", async () => {
    const fetch = fakeApi();
    renderAt("/reservations");

    await userEvent.click(await main().findByRole("button", { name: LORIS_BUTTON }));
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel booking" }),
    );

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
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel booking" }),
    );

    expect((await main().findByRole("alert")).textContent).toBe(
      "This booking has already started, so it can’t be cancelled.",
    );
    await waitFor(() => expect(listRequests(fetch)).toHaveLength(2));
  });
});

describe("reviewing a visit", () => {
  const REVIEW_BUTTON = "Review your visit, Lori Smokehouse, Friday 6 November, 20:00";

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
    await waitFor(() => expect(listRequests(fetch)).toHaveLength(2));
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
  const links = within(screen.getByRole("navigation", { name: "Main" }));
  await userEvent.click(await links.findByRole("link", { name: "My reservations" }));

  expect(await main().findByRole("status", { name: "Loading your reservations" })).toBeDefined();
  expect(main().queryByRole("link", { name: "Lori Smokehouse" })).toBeNull();
  expect(
    fetch.mock.calls.filter(([url]) => String(url).startsWith("/api/reservations?")),
  ).toHaveLength(2);
});

test("an owner is told the page is for guests, and nothing is asked for", async () => {
  const fetch = fakeApi({ user: ani });
  renderAt("/reservations");

  await waitFor(() => expect(document.title).toBe("This page is for guests · Seghan"));
  expect(listRequests(fetch)).toEqual([]);
});
