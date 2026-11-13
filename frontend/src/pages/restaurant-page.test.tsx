// @vitest-environment jsdom
// A restaurant's page, through the real routes, shell and hooks, with a fake API.
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Mock } from "vitest";

import {
  dolmamaPage,
  loriPage,
  loriSaturday,
  sampleBooked,
  sampleReviews,
  tsiranPage,
} from "@/features/design/samples";
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
  // Whether the guest saved Lori, as the server would remember it.
  let saved = false;
  const fetch = vi.fn((url: string, init?: RequestInit) => {
    if (url.startsWith("/api/favorites/")) {
      if (init?.method === "PUT") saved = true;
      if (init?.method === "DELETE") saved = false;
      return Promise.resolve(json({ saved }));
    }
    if (url.includes("/availability?")) {
      const date = new URLSearchParams(url.split("?")[1]).get("date");
      return Promise.resolve(json({ ...(availability?.() ?? loriSaturday), date }));
    }
    if (url === "/api/reservations" && init?.method === "POST") {
      return Promise.resolve(booking ?? json({ reservation: sampleBooked }, 201));
    }
    // Lori's twelve reviews, ten to a page.
    if (url.startsWith("/api/restaurants/lori-smokehouse/reviews?")) {
      const page = Number(new URLSearchParams(url.split("?")[1]).get("page"));
      const all = Array.from({ length: 12 }, (_, index) => ({
        ...sampleReviews[index % sampleReviews.length]!,
        id: `review-${index + 1}`,
      }));
      return Promise.resolve(
        json({
          data: all.slice((page - 1) * 10, page * 10),
          meta: { page, pageSize: 10, total: all.length },
        }),
      );
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
        // No reviews yet, and no map: as with maps not set up.
        return Promise.resolve(
          json({ restaurant: { ...tsiranPage, avgRating: 0, reviewCount: 0, mapImageUrl: null } }),
        );
      }
      if (url === "/api/restaurants/lori-smokehouse") {
        return Promise.resolve(json({ restaurant: loriPage }));
      }
      // A demo listing (9.7): real, but not on Seghan.
      if (url === "/api/restaurants/dolmama") {
        return Promise.resolve(json({ restaurant: dolmamaPage }));
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
const reviewRequests = (fetch: Mock): string[] =>
  requests(fetch).filter((url) => url.includes("/reviews?"));

beforeEach(() => {
  // Friday 13 November 2026, 14:00 in Yerevan, the day before the demo Saturday. Only the date is
  // fixed: timers stay real.
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-13T10:00:00Z") });
  // jsdom has no scrollTo(), which ScrollRestoration calls.
  window.scrollTo = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
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
  const crumbs = within(main().getByRole("navigation", { name: "Breadcrumb" }));
  expect(crumbs.getByRole("link", { name: "Restaurants" }).getAttribute("href")).toBe(
    "/restaurants",
  );
  // On a phone the breadcrumb gives way to a link back, over the photo.
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
  // Late on Friday and Saturday: a dash for the eye, "to" for screen readers.
  expect(main().getAllByText("18:00 – 02:00")).toHaveLength(2);
  expect(main().getAllByText("18:00 to 02:00")).toHaveLength(2);
  // Today is said in words, and in bold.
  expect(main().getByText("Friday (today)").className).toContain("font-semibold");
});

test.each([
  ["lori-smokehouse", "Open now · until 15:00"],
  ["tsiran-wine-room", "Opens at 18:00"],
])("at 14:00 on a Friday in Yerevan, %s says %s, after its address", async (slug, words) => {
  fakeApi();
  renderAt(`/restaurants/${slug}`);

  const open = await main().findByText(words);

  // One line under the name: what it is, where, and whether it's open.
  const line = open.parentElement as HTMLElement;
  const address = slug === "lori-smokehouse" ? loriPage.address : tsiranPage.address;
  expect(within(line).getByText(address).compareDocumentPosition(open)).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );
  expect(
    main().getByRole("heading", { level: 1 }).compareDocumentPosition(line) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

test("a demo listing's photo credits are said once, under the line about it", async () => {
  fakeApi();
  renderAt("/restaurants/dolmama");

  await main().findByRole("heading", { level: 1, name: "Dolmama" });

  expect(main().getAllByText(/via Wikimedia Commons/)).toHaveLength(1);
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

describe("reviews", () => {
  const reviewsSection = (): HTMLElement =>
    main().getByRole("heading", { name: "Reviews" }).closest("section")!;

  test("they follow the rating, ten at a time, and Show more adds the rest", async () => {
    const fetch = fakeApi();
    renderAt("/restaurants/lori-smokehouse");

    await waitFor(() => expect(within(reviewsSection()).getAllByRole("listitem")).toHaveLength(10));
    expect(reviewsSection().textContent).toContain("Rated 4.4 out of 5 by 18 guests.");

    await userEvent.click(
      within(reviewsSection()).getByRole("button", { name: "Show more reviews" }),
    );

    await waitFor(() => expect(within(reviewsSection()).getAllByRole("listitem")).toHaveLength(12));
    expect(
      within(reviewsSection()).queryByRole("button", { name: "Show more reviews" }),
    ).toBeNull();
    expect(reviewRequests(fetch)).toEqual([
      "/api/restaurants/lori-smokehouse/reviews?page=1",
      "/api/restaurants/lori-smokehouse/reviews?page=2",
    ]);
  });

  test("a restaurant without reviews says so, and asks for none", async () => {
    const fetch = fakeApi();
    renderAt("/restaurants/tsiran-wine-room");

    await waitFor(() =>
      expect(reviewsSection().textContent).toContain(
        "No reviews yet. Guests can leave one after their visit.",
      ),
    );
    expect(reviewRequests(fetch)).toEqual([]);
  });
});

describe("the map", () => {
  const locationSection = (): HTMLElement =>
    main().getByRole("heading", { name: "Location" }).closest("section")!;
  const mapImage = (): HTMLImageElement | null => locationSection().querySelector("img");
  const directions = (): HTMLElement =>
    within(locationSection()).getByRole("link", { name: "Get directions, opens in a new tab" });

  test("the picture of its street comes from our own API, with Get directions under it", async () => {
    fakeApi();
    renderAt("/restaurants/lori-smokehouse");
    await main().findByRole("heading", { level: 1, name: "Lori Smokehouse" });

    expect(mapImage()!.getAttribute("src")).toBe("/api/restaurants/lori-smokehouse/map");
    expect(
      mapImage()!.compareDocumentPosition(directions()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(directions().getAttribute("href")).toBe(loriPage.mapsUrl);
    expect(directions().getAttribute("target")).toBe("_blank");
    // With a map, the address isn't said again under it: the line under the name has it.
    expect(within(locationSection()).queryByText(loriPage.address)).toBeNull();
  });

  test("once the picture has come, a wine pin marks the place", async () => {
    fakeApi();
    renderAt("/restaurants/lori-smokehouse");
    await main().findByRole("heading", { level: 1, name: "Lori Smokehouse" });
    const frame = locationSection().querySelector('a[aria-hidden="true"]')!;
    expect(frame.querySelector(".bg-accent")).toBeNull();

    fireEvent.load(mapImage()!);

    expect(frame.querySelector(".bg-accent")).not.toBeNull();
  });

  test("when the picture can't load, the address and Get directions are all there is", async () => {
    fakeApi();
    renderAt("/restaurants/lori-smokehouse");
    await main().findByRole("heading", { level: 1, name: "Lori Smokehouse" });

    fireEvent.error(mapImage()!);

    expect(mapImage()).toBeNull();
    expect(locationSection().querySelector('a[aria-hidden="true"]')).toBeNull();
    // With no map, the address stands under Location.
    expect(within(locationSection()).getByText(loriPage.address)).toBeDefined();
    expect(directions()).toBeDefined();
  });

  test("with maps not set up, there's no map, no picture is asked for, and the address stands in", async () => {
    fakeApi();
    renderAt("/restaurants/tsiran-wine-room");
    await main().findByRole("heading", { level: 1, name: "Tsiran Wine Room" });

    expect(mapImage()).toBeNull();
    expect(locationSection().querySelector('a[aria-hidden="true"]')).toBeNull();
    // With no map, the address stands under Location.
    expect(within(locationSection()).getByText(tsiranPage.address)).toBeDefined();
    expect(directions()).toBeDefined();
  });
});

describe("saving it", () => {
  const guest: AuthUser = {
    id: "user-lilit",
    email: "lilit@example.com",
    name: "Lilit Harutyunyan",
    phone: null,
    role: "CUSTOMER",
  };
  const favoriteCalls = (fetch: Mock): string[] =>
    fetch.mock.calls
      .filter(([url]) => String(url).startsWith("/api/favorites/"))
      .map(([url, init]) => `${(init as RequestInit | undefined)?.method ?? "GET"} ${String(url)}`);

  test("a guest saves Lori from the top of its page, and takes it out again", async () => {
    const fetch = fakeApi({ user: guest });
    renderAt("/restaurants/lori-smokehouse");

    const save = await main().findByRole("button", { name: "Save Lori Smokehouse" });
    await waitFor(() => expect(save.getAttribute("aria-busy")).toBeNull());
    expect(save.getAttribute("aria-pressed")).toBe("false");

    await userEvent.click(save);
    const saved = await main().findByRole("button", { name: "Saved Lori Smokehouse" });
    expect(saved.getAttribute("aria-pressed")).toBe("true");

    await userEvent.click(saved);
    expect(await main().findByRole("button", { name: "Save Lori Smokehouse" })).toBeDefined();
    expect(favoriteCalls(fetch)).toEqual([
      "GET /api/favorites/lori-smokehouse",
      "PUT /api/favorites/lori-smokehouse",
      "DELETE /api/favorites/lori-smokehouse",
    ]);
  });

  test("signed out, Sign in to save goes to Sign in, and nothing is asked about favorites", async () => {
    const fetch = fakeApi();
    const router = renderAt("/restaurants/lori-smokehouse");

    await userEvent.click(await main().findByRole("link", { name: "Sign in to save" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(favoriteCalls(fetch)).toEqual([]);
  });

  test("an owner has no favorites, so there's nothing to save, and nothing is asked", async () => {
    const fetch = fakeApi({ user: { ...guest, name: "Ani Sargsyan", role: "OWNER" } });
    renderAt("/restaurants/lori-smokehouse");

    await main().findByRole("heading", { level: 1, name: "Lori Smokehouse" });
    await waitFor(() => expect(fetch.mock.calls.some(([url]) => url === "/api/me")).toBe(true));
    expect(main().queryByRole("button", { name: /^Save/ })).toBeNull();
    expect(main().queryByRole("link", { name: "Sign in to save" })).toBeNull();
    expect(favoriteCalls(fetch)).toEqual([]);
  });
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
  const isDisabled = (name: string): boolean =>
    (main().getByRole("button", { name }) as HTMLButtonElement).disabled;
  function sent(fetch: Mock): unknown {
    const booking = fetch.mock.calls.find(([url]) => url === "/api/reservations");
    if (!booking) throw new Error("Nothing was booked.");
    return JSON.parse(String((booking[1] as RequestInit).body));
  }

  afterEach(() => {
    focusManager.setFocused(undefined);
  });

  // The booking button's words, once a table is chosen at 19:00 on the demo Saturday.
  const RESERVE = "Reserve for 2 · Sat 14 Nov, 19:00";

  test("it starts on today, for two, and asks for that day's free tables", async () => {
    const fetch = fakeApi();
    renderAt(LORI);

    expect(await main().findByRole("heading", { level: 2, name: "Reserve a table" })).toBeDefined();
    const guests = within(main().getByRole("group", { name: "Guests" }));
    expect(guests.getByText("2 guests").tagName).toBe("OUTPUT");
    const days = within(main().getByRole("group", { name: "Date" }));
    expect(
      days.getByRole("button", { name: "Friday 13 November" }).getAttribute("aria-pressed"),
    ).toBe("true");
    await waitFor(() =>
      expect(availabilityRequests(fetch)).toEqual([
        "/api/restaurants/lori-smokehouse/availability?date=2026-11-13&partySize=2",
      ]),
    );
  });

  test("the choices come from the address, and go back into it as they change", async () => {
    fakeApi({ user: lilit });
    const router = renderAt(SEVEN_AT_T2);

    expect(await main().findByRole("button", { name: RESERVE })).toBeDefined();
    const days = within(main().getByRole("group", { name: "Date" }));
    expect(
      days.getByRole("button", { name: "Saturday 14 November" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(main().getByRole("button", { name: "19:00" }).getAttribute("aria-pressed")).toBe("true");
    expect(main().getByText("9 times available")).toBeDefined();
    // The free tables in one list, the smallest that fits the party marked.
    const tables = within(main().getByRole("group", { name: "Available tables at 19:00" }));
    const t2 = tables.getByRole<HTMLInputElement>("radio", { name: /^T2/ });
    expect(t2.checked).toBe(true);
    const t2Box = within(t2.closest("label") as HTMLElement);
    expect(t2Box.getByText("Indoor · 2 seats")).toBeDefined();
    expect(t2Box.getByText("Best fit")).toBeDefined();
    expect(tables.getAllByText("Best fit")).toHaveLength(1);

    await userEvent.click(main().getByRole("button", { name: "21:00" }));

    // A new time clears the table, so there's nothing to book yet.
    expect(chosen(router)).toEqual({ date: "2026-11-14", guests: "2", time: "21:00" });
    expect(main().queryByRole("button", { name: /^Reserve for/ })).toBeNull();
    expect(isDisabled("Choose a table")).toBe(true);
  });

  test("the last button waits, saying what's missing, until a time and a table are chosen", async () => {
    fakeApi({ user: lilit });
    renderAt(`${LORI}?date=2026-11-14&guests=2`);

    await main().findByRole("button", { name: "Choose a time and table" });
    expect(isDisabled("Choose a time and table")).toBe(true);
    expect(main().getByText(/^Choose a time to see which tables are free\./)).toBeDefined();

    await userEvent.click(await main().findByRole("button", { name: "19:00" }));
    expect(isDisabled("Choose a table")).toBe(true);

    await userEvent.click(main().getByRole("radio", { name: /^T2/ }));
    expect(isDisabled(RESERVE)).toBe(false);
  });

  test("more guests go into the address, and their tables are asked for", async () => {
    const fetch = fakeApi();
    const router = renderAt(`${LORI}?date=2026-11-14&guests=2`);

    await userEvent.click(await main().findByRole("button", { name: "More guests" }));

    expect(chosen(router)).toEqual({ date: "2026-11-14", guests: "3" });
    expect(
      within(main().getByRole("group", { name: "Guests" })).getByText("3 guests"),
    ).toBeDefined();
    await waitFor(() =>
      expect(availabilityRequests(fetch)).toContain(
        "/api/restaurants/lori-smokehouse/availability?date=2026-11-14&partySize=3",
      ),
    );
  });

  test("another day from the row goes into the address, and Later days moves the row on", async () => {
    const fetch = fakeApi();
    const router = renderAt(LORI);
    const days = within(await main().findByRole("group", { name: "Date" }));
    // The row starts today, so there's nothing earlier.
    expect(days.getByRole<HTMLButtonElement>("button", { name: "Earlier days" }).disabled).toBe(
      true,
    );

    await userEvent.click(days.getByRole("button", { name: "Saturday 14 November" }));

    expect(chosen(router)).toEqual({ date: "2026-11-14", guests: "2" });
    await waitFor(() =>
      expect(availabilityRequests(fetch)).toContain(
        "/api/restaurants/lori-smokehouse/availability?date=2026-11-14&partySize=2",
      ),
    );

    await userEvent.click(days.getByRole("button", { name: "Later days" }));

    expect(days.getByRole("button", { name: "Wednesday 18 November" })).toBeDefined();
    expect(days.queryByRole("button", { name: "Saturday 14 November" })).toBeNull();
  });

  test("a guest books a table, and the free tables are asked for again", async () => {
    const fetch = fakeApi({ user: lilit });
    renderAt(`${LORI}?date=2026-11-14&guests=2`);

    await userEvent.click(await main().findByRole("button", { name: "19:00" }));
    await userEvent.click(main().getByRole("radio", { name: /^T2/ }));
    await userEvent.type(
      main().getByLabelText("Note for the restaurant (optional)"),
      "A window seat, please",
    );
    await userEvent.click(main().getByRole("button", { name: RESERVE }));

    expect(await main().findByRole("heading", { name: "Booking requested" })).toBeDefined();
    expect(main().getByText("Waiting for the restaurant")).toBeDefined();
    expect(main().getByRole("link", { name: "View my reservations" }).getAttribute("href")).toBe(
      "/reservations",
    );
    expect(main().getByRole("button", { name: "Book another table" })).toBeDefined();
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

    await userEvent.click(await main().findByRole("button", { name: RESERVE }));

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
    await main().findByRole("button", { name: RESERVE });

    // Someone books T2 elsewhere. This window comes back into focus, which asks again.
    takenElsewhere = true;
    act(() => focusManager.setFocused(false));
    act(() => focusManager.setFocused(true));

    expect((await main().findByRole("alert")).textContent).toBe(
      "The table you chose isn’t free at 19:00 any more. Choose another.",
    );
    expect(main().queryByRole("button", { name: RESERVE })).toBeNull();
    expect(isDisabled("Choose a table")).toBe(true);
  });

  test("signed out, the last step signs in first, then comes back to the same choices", async () => {
    fakeApi();
    const router = renderAt(SEVEN_AT_T2);

    await userEvent.click(await main().findByRole("link", { name: "Sign in to reserve" }));

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
    expect(main().queryByRole("button", { name: /^Reserve for/ })).toBeNull();
  });
});

test("a demo listing's page offers its sample tables under one line saying it's a test booking, and has its Reviews", async () => {
  const fetch = fakeApi();
  renderAt("/restaurants/dolmama");

  expect(await main().findByRole("heading", { level: 2, name: "Reserve a table" })).toBeDefined();
  expect(
    main().getByText("This is a test booking. The restaurant won’t receive it."),
  ).toBeDefined();
  expect(main().queryByRole("heading", { name: "Demo listing" })).toBeNull();
  expect(main().getByRole("heading", { level: 2, name: "Reviews" })).toBeDefined();
  // Its times are asked for as any restaurant's are. Its reviews would be too, as soon as it had one.
  await waitFor(() => expect(availabilityRequests(fetch).length).toBeGreaterThan(0));
  expect(reviewRequests(fetch)).toEqual([]);
});
