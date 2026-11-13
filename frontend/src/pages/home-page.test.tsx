// @vitest-environment jsdom
// The home page, through the real routes, shell and hooks, with a fake API.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Mock } from "vitest";

import {
  armenianName,
  dolmamaListing,
  manyCuisines,
  noDescription,
  sampleRestaurants,
} from "@/features/design/samples";
import { yerevanToday } from "@/lib/time";
import { routes } from "@/router";
import type { AuthUser, AvailabilitySlot, RestaurantSummary } from "@/types/api";

type TestRouter = ReturnType<typeof createMemoryRouter>;

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status });

// One evening at every restaurant: lunch, a full 18:00, then free tables every half hour.
const slot = (starts: string, free: boolean): AvailabilitySlot => ({
  startsAt: "2026-11-13T15:00:00.000Z",
  endsAt: "2026-11-13T17:00:00.000Z",
  starts,
  ends: starts,
  tables: free ? [{ id: "table-t1", label: "T1", zone: "INDOOR", capacity: 2 }] : [],
});
const evening = [
  slot("12:00", true),
  slot("18:00", false),
  slot("18:30", true),
  slot("19:00", true),
  slot("19:30", true),
  slot("20:00", true),
];
// A restaurant whose evening is taken: only lunch is left.
const fullEvening = [slot("12:00", true), slot("18:00", false), slot("19:00", false)];

// More restaurants than the home page's two rows of four.
const tenRestaurants: RestaurantSummary[] = [
  ...sampleRestaurants,
  armenianName,
  manyCuisines,
  noDescription,
  dolmamaListing,
];

const aram: AuthUser = {
  id: "user-aram",
  email: "aram@example.com",
  name: "Aram Petrosyan",
  phone: null,
  role: "CUSTOMER",
};

interface FakeOptions {
  /** Who's signed in. Nobody, unless given. */
  user?: AuthUser;
  /** Every restaurant Seghan lists, by name. */
  restaurants?: RestaurantSummary[];
  /** The restaurants the guest has saved, by their address on Seghan. */
  saved?: string[];
  /** Restaurants with no table free this evening. */
  full?: string[];
}

/**
 * Answers like the API: searched by name or filtered by district, and paged. Its featured three are
 * the first by name, as the API's are when none of the chosen ones is published. Every restaurant
 * has the same evening, unless it's full. A guest's favorites are remembered as they change.
 */
function fakeApi({
  user,
  restaurants = sampleRestaurants,
  saved = [],
  full = [],
}: FakeOptions = {}): Mock {
  const savedNow = new Set(saved);
  const fetch = vi.fn((url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const { pathname, searchParams } = new URL(url, "http://seghan.test");
    if (pathname === "/api/restaurants/featured") {
      return Promise.resolve(
        json({
          data: restaurants.slice(0, 3),
          meta: { page: 1, pageSize: 3, total: restaurants.length },
        }),
      );
    }
    const timesOf = /^\/api\/restaurants\/([^/]+)\/availability$/.exec(pathname)?.[1];
    if (timesOf) {
      return Promise.resolve(
        json({
          date: searchParams.get("date"),
          partySize: Number(searchParams.get("partySize")),
          bookingWindow: { first: "2026-11-13", last: "2027-01-12" },
          slots: full.includes(timesOf) ? fullEvening : evening,
        }),
      );
    }
    if (pathname === "/api/restaurants") {
      const q = searchParams.get("q")?.toLowerCase();
      const district = searchParams.get("district");
      const pageSize = Number(searchParams.get("pageSize") ?? 12);
      const found = restaurants.filter(
        (r) => (!q || r.name.toLowerCase().includes(q)) && (!district || r.district === district),
      );
      return Promise.resolve(
        json({
          data: found.slice(0, pageSize),
          meta: { page: 1, pageSize, total: found.length },
        }),
      );
    }
    const favorite = /^\/api\/favorites\/([^/]+)$/.exec(pathname)?.[1];
    if (favorite && user) {
      if (method === "PUT") savedNow.add(favorite);
      if (method === "DELETE") savedNow.delete(favorite);
      return Promise.resolve(json({ saved: savedNow.has(favorite) }));
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

const requests = (fetch: Mock): string[] =>
  fetch.mock.calls.map(([url, init]) => {
    const method = (init as RequestInit | undefined)?.method ?? "GET";
    return `${method} ${String(url)}`;
  });

beforeEach(() => {
  // Friday 13 November 2026, 14:00 in Yerevan, so the search starts today at 19:30. Only the date
  // is fixed: timers stay real.
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
const cardNames = (): (string | null)[] =>
  main()
    .getAllByRole("heading", { level: 3 })
    .map((heading: HTMLElement) => heading.textContent);
/** The address's query, as plain values: URLSearchParams writes 19:30 as 19%3A30. */
const queryOf = (router: TestRouter): Record<string, string> =>
  Object.fromEntries(new URLSearchParams(router.state.location.search));

test("leads with its headline, how many restaurants take bookings, and cuisines to browse", async () => {
  fakeApi();
  renderAt("/");

  const headline = await main().findByRole("heading", { level: 1 });
  expect(headline.textContent).toBe("Find a table in Yerevan, tonight or any night.");
  expect(await main().findByText("Yerevan · 6 restaurants taking bookings")).toBeDefined();
  const cuisines = main().getByRole("navigation", { name: "Cuisines" });
  expect(within(cuisines).getByRole("link", { name: "Armenian" }).getAttribute("href")).toBe(
    "/restaurants?cuisine=ARMENIAN",
  );
});

test("the search for a table starts today, at 19:30, for two", async () => {
  fakeApi();
  renderAt("/");

  const search = within(await main().findByRole("search", { name: "Find a table" }));

  expect(search.getByLabelText("Restaurant, dish or street")).toBeDefined();
  expect((search.getByLabelText("Date") as HTMLSelectElement).value).toBe("2026-11-13");
  expect((search.getByLabelText("Time") as HTMLSelectElement).value).toBe("19:30");
  expect((search.getByLabelText("Guests") as HTMLSelectElement).value).toBe("2");
  expect(search.getByRole("button", { name: "Find a table" })).toBeDefined();
});

test("shows the featured restaurants first, then others to fill the rows, each with tonight's first free times", async () => {
  const fetch = fakeApi();
  renderAt("/");

  expect(await main().findByRole("link", { name: "Kond House" })).toBeDefined();
  expect(cardNames()).toEqual([
    "Kond House",
    "Lori Smokehouse",
    "Nurr",
    "Sevan & Salt",
    "Tbilisi Courtyard",
    "Tsiran Wine Room",
  ]);
  expect(requests(fetch)).toEqual(
    expect.arrayContaining(["GET /api/restaurants/featured", "GET /api/restaurants?pageSize=8"]),
  );
  // Not lunch, and not the full 18:00: the first three free from 18:00.
  const times = await main().findByRole("list", { name: "Free tonight at Kond House" });
  expect(
    within(times)
      .getAllByRole("link")
      .map((link) => link.textContent),
  ).toEqual(["18:30", "19:00", "19:30"]);
  expect(requests(fetch)).toContain(
    `GET /api/restaurants/kond-house/availability?date=${yerevanToday()}&partySize=2`,
  );
  // Every restaurant is already on the page, so the link doesn't promise more.
  expect(main().getByRole("link", { name: "Browse restaurants" }).getAttribute("href")).toBe(
    "/restaurants",
  );
});

test("with more restaurants than two rows hold, it shows eight, and the link says how many there are", async () => {
  fakeApi({ restaurants: tenRestaurants });
  renderAt("/");

  await main().findByRole("link", { name: "Kond House" });

  expect(cardNames()).toHaveLength(8);
  expect(main().getByRole("link", { name: "See all 10" }).getAttribute("href")).toBe(
    "/restaurants",
  );
  expect(await main().findByText("Yerevan · 10 restaurants taking bookings")).toBeDefined();
});

test("a restaurant with no table free tonight says so, and offers another time", async () => {
  fakeApi({ full: ["nurr"] });
  renderAt("/");

  const nurr = (await main().findByRole("link", { name: "Nurr" })).closest(
    "article",
  ) as HTMLElement;

  expect(await within(nurr).findByText("No tables free tonight.")).toBeDefined();
  expect(within(nurr).getByRole("link", { name: "Choose another time" }).getAttribute("href")).toBe(
    "/restaurants/nurr",
  );
  expect(within(nurr).queryByRole("list", { name: "Free tonight at Nurr" })).toBeNull();
});

test("a time opens the restaurant with the booking already at it, for two, tonight", async () => {
  fakeApi();
  const router = renderAt("/");

  await userEvent.click(
    await main().findByRole("link", { name: "Book Kond House tonight at 19:00" }),
  );

  expect(router.state.location.pathname).toBe("/restaurants/kond-house");
  expect(queryOf(router)).toEqual({
    date: yerevanToday(),
    guests: "2",
    time: "19:00",
  });
});

test("a search lands on Browse, with the box filled and the list found", async () => {
  fakeApi();
  const router = renderAt("/");

  await userEvent.type(await main().findByLabelText("Restaurant, dish or street"), "nurr{Enter}");

  expect(await main().findByText("1 restaurant")).toBeDefined();
  expect(router.state.location.pathname).toBe("/restaurants");
  // The day, time and party go along too, so Browse shows the times nearest them.
  expect(queryOf(router)).toEqual({ q: "nurr", date: "2026-11-13", time: "19:30", guests: "2" });
  expect((main().getByLabelText("Restaurant, dish or street") as HTMLInputElement).value).toBe(
    "nurr",
  );
});

test("Find a table takes the day, the time and the party chosen to Browse", async () => {
  const fetch = fakeApi();
  const router = renderAt("/");
  const search = within(await main().findByRole("search", { name: "Find a table" }));

  await userEvent.selectOptions(search.getByLabelText("Date"), "2026-11-14");
  await userEvent.selectOptions(search.getByLabelText("Time"), "20:00");
  await userEvent.selectOptions(search.getByLabelText("Guests"), "4");
  await userEvent.click(search.getByRole("button", { name: "Find a table" }));

  expect(router.state.location.pathname).toBe("/restaurants");
  expect(queryOf(router)).toEqual({ date: "2026-11-14", time: "20:00", guests: "4" });
  // Each card on Browse asks for that day and party.
  expect(
    await main().findByRole("list", { name: "Free on Saturday 14 November at Nurr" }),
  ).toBeDefined();
  expect(requests(fetch)).toContain(
    "GET /api/restaurants/nurr/availability?date=2026-11-14&partySize=4",
  );
});

test("a card opens the restaurant's own page", async () => {
  fakeApi();
  const router = renderAt("/");

  await userEvent.click(await main().findByRole("link", { name: "Lori Smokehouse" }));

  expect(router.state.location.pathname).toBe("/restaurants/lori-smokehouse");
});

test("signed out, each card's heart asks to sign in first, and nothing is asked about favorites", async () => {
  const fetch = fakeApi();
  const router = renderAt("/");

  await userEvent.click(await main().findByRole("link", { name: "Sign in to save Kond House" }));

  expect(router.state.location.pathname).toBe("/login");
  // Signing in brings the person back here.
  expect(router.state.location.state).toEqual({ from: { pathname: "/", search: "", hash: "" } });
  expect(requests(fetch).some((request) => request.includes("/api/favorites"))).toBe(false);
});

test("a guest's hearts say which restaurants are saved, and a tap saves one", async () => {
  const fetch = fakeApi({ user: aram, saved: ["lori-smokehouse"] });
  renderAt("/");

  const lori = await main().findByRole("button", { name: "Saved Lori Smokehouse" });
  expect(lori.getAttribute("aria-pressed")).toBe("true");
  const kond = await main().findByRole("button", { name: "Save Kond House" });
  expect(kond.getAttribute("aria-pressed")).toBe("false");
  expect(requests(fetch)).toContain("GET /api/favorites/kond-house");

  await userEvent.click(kond);

  const saved = await main().findByRole("button", { name: "Saved Kond House" });
  expect(saved.getAttribute("aria-pressed")).toBe("true");
  expect(requests(fetch)).toContain("PUT /api/favorites/kond-house");
});

test("each district opens Browse filtered to it, and says how many restaurants it has", async () => {
  fakeApi();
  renderAt("/");

  const areas = await main().findByRole("region", { name: "Explore by neighborhood" });
  const kentron = await within(areas).findByRole("link", { name: "Kentron 3 restaurants" });
  expect(kentron.getAttribute("href")).toBe("/restaurants?district=KENTRON");
  expect(
    within(areas).getByRole("link", { name: "Arabkir 1 restaurant" }).getAttribute("href"),
  ).toBe("/restaurants?district=ARABKIR");
  // Where the header's Neighborhoods link lands.
  expect(areas.id).toBe("neighborhoods");
});

test("someone signed out is invited to list a restaurant", async () => {
  fakeApi();
  renderAt("/");

  const band = await main().findByRole("region", { name: "Run a restaurant in Yerevan?" });
  expect(
    within(band).getByRole("link", { name: "List your restaurant" }).getAttribute("href"),
  ).toBe("/register?role=owner");
});

test("a guest who's signed in isn't invited to list a restaurant", async () => {
  fakeApi({ user: aram });
  renderAt("/");

  // The header knows who's signed in once it offers Sign out.
  await within(screen.getByRole("banner")).findByRole("button", { name: "Sign out" });
  expect(main().queryByRole("region", { name: "Run a restaurant in Yerevan?" })).toBeNull();
  expect(main().getByRole("heading", { level: 1 })).toBeDefined();
});
