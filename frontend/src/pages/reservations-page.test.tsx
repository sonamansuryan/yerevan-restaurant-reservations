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

interface FakeOptions {
  user?: AuthUser;
  /** What cancelling answers, if not a success. */
  refusal?: () => Response;
}

/** The API, for a signed-in user. A cancel that succeeds shows in the lists asked for after it. */
function fakeApi({ user = lilit, refusal }: FakeOptions = {}): Mock {
  let upcoming = guestUpcoming;
  const fetch = vi.fn((url: string, init?: RequestInit) => {
    if (url === "/api/me") return Promise.resolve(json({ user }));
    if (url.startsWith("/api/reservations?")) {
      const query = new URLSearchParams(url.split("?")[1]);
      const data = query.get("when") === "past" ? guestPast : upcoming;
      const page = Number(query.get("page"));
      return Promise.resolve(json({ data, meta: { page, pageSize: 20, total: data.length } }));
    }
    if (url === `/api/reservations/${lori.id}` && init?.method === "PATCH") {
      if (refusal) return Promise.resolve(refusal());
      upcoming = upcoming.map((one) => (one.id === lori.id ? loriCancelled : one));
      return Promise.resolve(json({ reservation: loriCancelled }));
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

test("an owner is told the page is for guests, and nothing is asked for", async () => {
  const fetch = fakeApi({ user: ani });
  renderAt("/reservations");

  await waitFor(() => expect(document.title).toBe("This page is for guests · Seghan"));
  expect(listRequests(fetch)).toEqual([]);
});
