// @vitest-environment jsdom
// A restaurant's page, through the real routes, shell and hooks, with a fake API.
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Mock } from "vitest";

import { loriPage, loriSaturday, sampleBooked, tsiranPage } from "@/features/design/samples";
import { routes } from "@/router";
import type { AuthUser, Availability } from "@/types/api";

type TestRouter = ReturnType<typeof createMemoryRouter>;

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status });

interface FakeOptions {
  /** How many requests for a restaurant's page fail first, as with no connection. */
  failures?: number;
  /** Who's signed in: nobody, unless this says. */
  user?: AuthUser | null;
  /** What booking answers, if not a success. */
  booking?: Response;
  /** The free tables, asked for each time. Lori's demo Saturday unless this says. */
  availability?: () => Availability;
}

/**
 * Answers like the API, with Tsiran Wine Room and Lori Smokehouse as the only restaurants. Every
 * date has Lori's demo Saturday's times and free tables.
 */
function fakeApi({ failures = 0, user = null, booking, availability }: FakeOptions = {}): Mock {
  let failuresLeft = failures;
  const fetch = vi.fn((url: string, init?: RequestInit) => {
    if (url.includes("/availability?")) {
      const date = new URLSearchParams(url.split("?")[1]).get("date");
      return Promise.resolve(json({ ...(availability?.() ?? loriSaturday), date }));
    }
    if (url === "/api/reservations" && init?.method === "POST") {
      return Promise.resolve(booking ?? json({ reservation: sampleBooked }, 201));
    }
    if (url === "/api/restaurants") {
      return Promise.resolve(
        json({ data: [tsiranPage], meta: { page: 1, pageSize: 12, total: 1 } }),
      );
    }
    if (url.startsWith("/api/restaurants/")) {
      if (failuresLeft > 0) {
        failuresLeft -= 1;
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      if (url === "/api/restaurants/tsiran-wine-room") {
        return Promise.resolve(json({ restaurant: tsiranPage }));
      }
      if (url === "/api/restaurants/lori-smokehouse") {
        return Promise.resolve(json({ restaurant: loriPage }));
      }
      return Promise.resolve(
        json(
          {
            error: { code: "RESTAURANT_NOT_FOUND", message: "We couldn’t find this restaurant." },
          },
          404,
        ),
      );
    }
    if (url === "/api/me" && user) return Promise.resolve(json({ user }));
    if (url === "/api/me" || url === "/api/auth/refresh") {
      return Promise.resolve(
        json({ error: { code: "UNAUTHORIZED", message: "Please sign in." } }, 401),
      );
    }
    return new Promise(() => {});
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const requests = (fetch: Mock): string[] => fetch.mock.calls.map(([url]) => String(url));
const pageRequests = (fetch: Mock): string[] =>
  requests(fetch).filter((url) => url.startsWith("/api/restaurants/") && !url.includes("?"));
const availabilityRequests = (fetch: Mock): string[] =>
  requests(fetch).filter((url) => url.includes("/availability?"));

beforeEach(() => {
  // jsdom has no scrollTo(), which ScrollRestoration calls.
  window.scrollTo = vi.fn();
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

test("a card on Browse opens the restaurant's page", async () => {
  fakeApi();
  const router = renderAt("/restaurants");

  await userEvent.click(await main().findByRole("link", { name: "Tsiran Wine Room" }));

  expect(await main().findByRole("heading", { level: 1, name: "Tsiran Wine Room" })).toBeDefined();
  expect(router.state.location.pathname).toBe("/restaurants/tsiran-wine-room");
  expect(document.title).toBe("Tsiran Wine Room · Seghan");
  expect(main().getByRole("link", { name: "All restaurants" }).getAttribute("href")).toBe(
    "/restaurants",
  );
});

test("opened directly, it asks for that restaurant and shows its hours", async () => {
  const fetch = fakeApi();
  renderAt("/restaurants/tsiran-wine-room");

  expect(await main().findByRole("heading", { level: 2, name: "Opening hours" })).toBeDefined();
  expect(pageRequests(fetch)).toEqual(["/api/restaurants/tsiran-wine-room"]);
  expect(main().getAllByText("Closed").length).toBeGreaterThan(0);
  // Late on Friday and Saturday.
  expect(main().getAllByText("18:00 to 02:00")).toHaveLength(2);
});

test("a restaurant that isn't there gets the not-found page, and isn't asked for twice", async () => {
  const fetch = fakeApi();
  renderAt("/restaurants/davtashen-test-kitchen");

  expect(
    await main().findByRole("heading", { level: 1, name: "Restaurant not found" }),
  ).toBeDefined();
  expect(main().getByRole("link", { name: "See all restaurants" }).getAttribute("href")).toBe(
    "/restaurants",
  );
  expect(document.title).toBe("Restaurant not found · Seghan");
  expect(pageRequests(fetch)).toEqual(["/api/restaurants/davtashen-test-kitchen"]);
});

test("when it can't load, Try again brings it", async () => {
  // The first try and its one automatic retry both fail.
  fakeApi({ failures: 2 });
  renderAt("/restaurants/tsiran-wine-room");

  const retry = await main().findByRole("button", { name: "Try again" }, { timeout: 4000 });
  expect(main().getByText("We couldn’t load this restaurant.")).toBeDefined();
  await userEvent.click(retry);

  expect(await main().findByRole("heading", { level: 1, name: "Tsiran Wine Room" })).toBeDefined();
});

test("an odd address is sent encoded, so it can't change the request", async () => {
  const fetch = fakeApi();
  renderAt("/restaurants/odd%20%26%20name%3Fq");

  await main().findByRole("heading", { level: 1, name: "Restaurant not found" });
  expect(pageRequests(fetch)).toEqual(["/api/restaurants/odd%20%26%20name%3Fq"]);
});

describe("booking a table", () => {
  const LORI = "/restaurants/lori-smokehouse";
  const SEVEN_AT_T2 = `${LORI}?date=2026-11-14&guests=2&time=19:00&table=table-t2`;
  const lilit: AuthUser = {
    id: "user-lilit",
    email: "lilit@example.com",
    name: "Lilit Harutyunyan",
    phone: null,
    role: "CUSTOMER",
  };
  const chosen = (router: TestRouter): Record<string, string> =>
    Object.fromEntries(new URLSearchParams(router.state.location.search));
  function sent(fetch: Mock): unknown {
    const booking = fetch.mock.calls.find(([url]) => url === "/api/reservations");
    if (!booking) throw new Error("Nothing was booked.");
    return JSON.parse(String((booking[1] as RequestInit).body));
  }

  beforeEach(() => {
    // Friday 13 November 2026, 14:00 in Yerevan, the day before the demo Saturday.
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-13T10:00:00Z") });
  });

  afterEach(() => {
    vi.useRealTimers();
    focusManager.setFocused(undefined);
  });

  test("it starts on today, for two, and asks for that day's free tables", async () => {
    const fetch = fakeApi();
    renderAt(LORI);

    expect(await main().findByRole("heading", { level: 2, name: "Book a table" })).toBeDefined();
    expect((main().getByLabelText("Date") as HTMLInputElement).value).toBe("2026-11-13");
    expect((main().getByLabelText("Guests") as HTMLSelectElement).value).toBe("2");
    await waitFor(() =>
      expect(availabilityRequests(fetch)).toEqual([
        "/api/restaurants/lori-smokehouse/availability?date=2026-11-13&partySize=2",
      ]),
    );
  });

  test("the choices come from the address, and go back into it as they change", async () => {
    fakeApi({ user: lilit });
    const router = renderAt(SEVEN_AT_T2);

    expect(
      await main().findByText("A table for two on Saturday 14 November at 19:00, indoors."),
    ).toBeDefined();
    expect(main().getByRole("button", { name: "19:00" }).getAttribute("aria-pressed")).toBe("true");

    await userEvent.click(main().getByRole("button", { name: "21:00" }));

    // A new time clears the table, so there's nothing to book yet.
    expect(chosen(router)).toEqual({ date: "2026-11-14", guests: "2", time: "21:00" });
    expect(main().queryByRole("button", { name: "Book this table" })).toBeNull();
  });

  test("a guest books a table, and the free tables are asked for again", async () => {
    const fetch = fakeApi({ user: lilit });
    renderAt(`${LORI}?date=2026-11-14&guests=2`);

    await userEvent.click(await main().findByRole("button", { name: "19:00" }));
    await userEvent.click(main().getByRole("radio", { name: /T2/ }));
    await userEvent.type(main().getByLabelText("Special requests"), "A window seat, please");
    await userEvent.click(main().getByRole("button", { name: "Book this table" }));

    expect(await main().findByRole("heading", { name: "Booking requested" })).toBeDefined();
    expect(main().getByText("Waiting for the restaurant")).toBeDefined();
    expect(sent(fetch)).toEqual({
      tableId: "table-t2",
      date: "2026-11-14",
      time: "19:00",
      partySize: 2,
      specialRequests: "A window seat, please",
    });
    await waitFor(() => expect(availabilityRequests(fetch)).toHaveLength(2));
  });

  test("a table taken meanwhile is no longer chosen, the reason shows, and the tables are asked for again", async () => {
    const fetch = fakeApi({
      user: lilit,
      booking: json(
        {
          error: {
            code: "SLOT_TAKEN",
            message:
              "Sorry, this table was just booked for that time. Please choose another time or table.",
          },
        },
        409,
      ),
    });
    const router = renderAt(SEVEN_AT_T2);

    await userEvent.click(await main().findByRole("button", { name: "Book this table" }));

    expect((await main().findByRole("alert")).textContent).toContain("this table was just booked");
    expect(chosen(router)).toEqual({ date: "2026-11-14", guests: "2", time: "19:00" });
    await waitFor(() => expect(availabilityRequests(fetch)).toHaveLength(2));
  });

  test("when the table is taken in another window, coming back to this one says so", async () => {
    let takenElsewhere = false;
    const withoutT2: Availability = {
      ...loriSaturday,
      slots: loriSaturday.slots.map((slot) => ({
        ...slot,
        tables: slot.tables.filter(({ id }) => id !== "table-t2"),
      })),
    };
    fakeApi({ user: lilit, availability: () => (takenElsewhere ? withoutT2 : loriSaturday) });
    renderAt(SEVEN_AT_T2);
    await main().findByRole("button", { name: "Book this table" });

    // Someone books T2 elsewhere. This window comes back into focus, which asks again.
    takenElsewhere = true;
    act(() => focusManager.setFocused(false));
    act(() => focusManager.setFocused(true));

    expect((await main().findByRole("alert")).textContent).toBe(
      "The table you chose isn’t free at 19:00 any more. Choose another.",
    );
    expect(main().queryByRole("button", { name: "Book this table" })).toBeNull();
  });

  test("signed out, the last step signs in first, then comes back to the same choices", async () => {
    fakeApi();
    const router = renderAt(SEVEN_AT_T2);

    await userEvent.click(await main().findByRole("link", { name: "Sign in to book" }));

    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.state).toEqual({
      from: {
        pathname: LORI,
        search: "?date=2026-11-14&guests=2&time=19:00&table=table-t2",
        hash: "",
      },
    });
  });

  test("an owner's account is told why it can't book", async () => {
    fakeApi({ user: { ...lilit, name: "Ani Sargsyan", role: "OWNER" } });
    renderAt(SEVEN_AT_T2);

    expect(
      await main().findByText(
        "Tables are booked from a guest account. You’re signed in as Ani Sargsyan.",
      ),
    ).toBeDefined();
    expect(main().queryByRole("button", { name: "Book this table" })).toBeNull();
  });
});
