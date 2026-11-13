// @vitest-environment jsdom
// Browse, through the real routes, shell and hooks, with a fake API that filters and pages a small
// list the way the server does.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Mock } from "vitest";

import { routes } from "@/router";
import type { AvailabilitySlot, District, RestaurantSummary } from "@/types/api";

type TestRouter = ReturnType<typeof createMemoryRouter>;

const restaurant = (slug: string, name: string, district: District): RestaurantSummary => ({
  slug,
  name,
  description: null,
  cuisines: ["ARMENIAN"],
  district,
  address: "Yerevan",
  priceLevel: 2,
  avgRating: 0,
  reviewCount: 0,
  coverPhotoUrl: null,
  isDemoListing: false,
});

const threeRestaurants = [
  restaurant("kond-house", "Kond House", "KENTRON"),
  restaurant("lori-smokehouse", "Lori Smokehouse", "ARABKIR"),
  restaurant("nurr", "Nurr", "KENTRON"),
];

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status });

// Every restaurant's evening: a full 18:00, then a free table every half hour until 21:00.
const slot = (starts: string, free: boolean): AvailabilitySlot => ({
  startsAt: "2026-11-13T15:00:00.000Z",
  endsAt: "2026-11-13T17:00:00.000Z",
  starts,
  ends: starts,
  tables: free ? [{ id: "table-t1", label: "T1", zone: "INDOOR", capacity: 4 }] : [],
});
const evening = [
  slot("18:00", false),
  ...["18:30", "19:00", "19:30", "20:00", "20:30", "21:00"].map((starts) => slot(starts, true)),
];

/**
 * Answers like the API: nobody is signed in, and /api/restaurants filters by district and search,
 * and sorts by name or rating, 12 to a page. `failures` makes that many list requests fail first, as with no connection.
 * Each restaurant has the same evening, on any day and for any party.
 */
function fakeApi(list: RestaurantSummary[] = threeRestaurants, failures = 0): Mock {
  let failuresLeft = failures;
  const fetch = vi.fn((url: string) => {
    const { pathname, searchParams } = new URL(url, "http://seghan.test");
    if (/^\/api\/restaurants\/[^/]+\/availability$/.test(pathname)) {
      return Promise.resolve(
        json({
          date: searchParams.get("date"),
          partySize: Number(searchParams.get("partySize")),
          bookingWindow: { first: "2026-11-13", last: "2027-01-12" },
          slots: evening,
        }),
      );
    }
    if (pathname === "/api/restaurants") {
      if (failuresLeft > 0) {
        failuresLeft -= 1;
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      const district = searchParams.get("district");
      const q = searchParams.get("q")?.toLowerCase();
      const page = Number(searchParams.get("page") ?? 1);
      const found = list.filter(
        (item) =>
          (!district || item.district === district) && (!q || item.name.toLowerCase().includes(q)),
      );
      if (searchParams.get("sort") === "rating") {
        found.sort(
          (a, b) =>
            b.avgRating - a.avgRating ||
            b.reviewCount - a.reviewCount ||
            a.name.localeCompare(b.name),
        );
      }
      return Promise.resolve(
        json({
          data: found.slice((page - 1) * 12, page * 12),
          meta: { page, pageSize: 12, total: found.length },
        }),
      );
    }
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

/** The addresses Browse asked the API for its list, in order. Each card's times are apart. */
const listRequests = (fetch: Mock): string[] =>
  fetch.mock.calls
    .map(([url]) => String(url))
    .filter((url) => url === "/api/restaurants" || url.startsWith("/api/restaurants?"));

/** The cards' own requests for their free times. */
const timesRequests = (fetch: Mock): string[] =>
  fetch.mock.calls.map(([url]) => String(url)).filter((url) => url.includes("/availability"));

/** The address's query, as plain values: URLSearchParams writes 19:30 as 19%3A30. */
const queryOf = (router: TestRouter): Record<string, string> =>
  Object.fromEntries(new URLSearchParams(router.state.location.search));

beforeEach(() => {
  // Friday 13 November 2026, 14:00 in Yerevan, so a table is looked for today at 19:30. Only the
  // date is fixed: timers stay real.
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
const cardNames = (): string[] =>
  main()
    .getAllByRole("heading", { level: 2 })
    .map((heading: HTMLElement) => heading.textContent ?? "");

test("lists the restaurants from the API, each linking to its own page", async () => {
  fakeApi();
  renderAt("/restaurants");

  expect(await main().findByText("3 restaurants")).toBeDefined();
  expect(cardNames()).toEqual(["Kond House", "Lori Smokehouse", "Nurr"]);
  expect(main().getByRole("link", { name: "Nurr" }).getAttribute("href")).toBe("/restaurants/nurr");
  expect(document.title).toBe("Restaurants · Seghan");
  // Each card has a heart, which asks someone signed out to sign in first.
  expect(main().getByRole("link", { name: "Sign in to save Nurr" }).getAttribute("href")).toBe(
    "/login",
  );
});

test("each card shows its free times nearest the time looked for, each opening the booking at it", async () => {
  const fetch = fakeApi();
  renderAt("/restaurants");

  // Today at 19:30 for two, until another table is looked for.
  const times = await main().findByRole("list", { name: "Free today at Kond House" });
  expect(
    within(times)
      .getAllByRole("link")
      .map((link) => link.textContent),
  ).toEqual(["19:00", "19:30", "20:00"]);
  const at1930 = within(times).getByRole("link", { name: "Book Kond House today at 19:30" });
  expect(at1930.getAttribute("href")).toBe(
    "/restaurants/kond-house?date=2026-11-13&guests=2&time=19%3A30",
  );
  expect(timesRequests(fetch)).toEqual([
    "/api/restaurants/kond-house/availability?date=2026-11-13&partySize=2",
    "/api/restaurants/lori-smokehouse/availability?date=2026-11-13&partySize=2",
    "/api/restaurants/nurr/availability?date=2026-11-13&partySize=2",
  ]);
});

test("another day, time and party in the address change every card's times", async () => {
  const fetch = fakeApi();
  renderAt("/restaurants?date=2026-11-14&time=20:00&guests=4");

  const times = await main().findByRole("list", { name: "Free on Saturday 14 November at Nurr" });
  expect(
    within(times)
      .getAllByRole("link")
      .map((link) => link.textContent),
  ).toEqual(["19:30", "20:00", "20:30"]);
  expect(
    within(times)
      .getByRole("link", { name: "Book Nurr on Saturday 14 November at 20:00" })
      .getAttribute("href"),
  ).toBe("/restaurants/nurr?date=2026-11-14&guests=4&time=20%3A00");
  expect(timesRequests(fetch)).toContain(
    "/api/restaurants/nurr/availability?date=2026-11-14&partySize=4",
  );
  // The bar shows the table looked for.
  expect((main().getByLabelText("Date") as HTMLSelectElement).value).toBe("2026-11-14");
  expect((main().getByLabelText("Time") as HTMLSelectElement).value).toBe("20:00");
  expect((main().getByLabelText("Guests") as HTMLSelectElement).value).toBe("4");
});

test("choosing a district puts it in the address and asks the API for it", async () => {
  const fetch = fakeApi();
  const router = renderAt("/restaurants");
  await main().findByText("3 restaurants");

  await userEvent.selectOptions(main().getByLabelText("District"), "Kentron");

  expect(await main().findByText("2 restaurants")).toBeDefined();
  expect(router.state.location.search).toBe("?district=KENTRON");
  expect(listRequests(fetch).at(-1)).toBe("/api/restaurants?district=KENTRON");
  expect(cardNames()).toEqual(["Kond House", "Nurr"]);
});

test("a link with a district, such as the footer's, opens the list already filtered", async () => {
  const fetch = fakeApi();
  renderAt("/restaurants?district=ARABKIR");

  expect(await main().findByText("1 restaurant")).toBeDefined();
  expect((main().getByLabelText("District") as HTMLSelectElement).value).toBe("ARABKIR");
  expect(listRequests(fetch)).toEqual(["/api/restaurants?district=ARABKIR"]);
});

test("a search runs when it's sent, with the table looked for, and Back undoes it", async () => {
  const fetch = fakeApi();
  const router = renderAt("/restaurants");
  await main().findByText("3 restaurants");

  const box = main().getByLabelText("Restaurant, dish or street");
  expect(box.getAttribute("placeholder")).toBe("Name, dish or street");
  await userEvent.type(box, "lori");
  await userEvent.click(main().getByRole("button", { name: "Search" }));
  expect(await main().findByText("1 restaurant")).toBeDefined();
  // The day, time and party always go along, as their choices always have a value.
  expect(queryOf(router)).toEqual({ q: "lori", date: "2026-11-13", time: "19:30", guests: "2" });
  const asked = new URL(listRequests(fetch).at(-1) ?? "", "http://seghan.test");
  expect(asked.searchParams.get("q")).toBe("lori");

  await router.navigate(-1);
  expect(await main().findByText("3 restaurants")).toBeDefined();
  // The search box follows the address back.
  expect((main().getByLabelText("Restaurant, dish or street") as HTMLInputElement).value).toBe("");
});

test("nothing found has one way out: clearing the filters", async () => {
  fakeApi();
  const router = renderAt("/restaurants?q=pizza&district=KENTRON");

  expect(await main().findByText("No restaurants match")).toBeDefined();
  await userEvent.click(main().getByRole("button", { name: "Clear filters" }));

  expect(await main().findByText("3 restaurants")).toBeDefined();
  expect(router.state.location.search).toBe("");
});

test("Sort by Highest rated goes into the address, and the best rated come first, with their ratings", async () => {
  const rated = [
    restaurant("kond-house", "Kond House", "KENTRON"),
    {
      ...restaurant("lori-smokehouse", "Lori Smokehouse", "ARABKIR"),
      avgRating: 4.4,
      reviewCount: 18,
    },
    { ...restaurant("nurr", "Nurr", "KENTRON"), avgRating: 4.8, reviewCount: 5 },
  ];
  const fetch = fakeApi(rated);
  const router = renderAt("/restaurants");
  await main().findByText("3 restaurants");

  await userEvent.selectOptions(main().getByLabelText("Sort by"), "Highest rated");

  await waitFor(() => expect(cardNames()).toEqual(["Nurr", "Lori Smokehouse", "Kond House"]));
  expect(router.state.location.search).toBe("?sort=rating");
  expect(listRequests(fetch).at(-1)).toBe("/api/restaurants?sort=rating");
  const nurr = main().getByRole("link", { name: "Nurr" }).closest("article");
  expect(nurr?.textContent).toContain("Rated 4.8 by 5 guests");
});

test("clearing the filters keeps the order", async () => {
  fakeApi();
  const router = renderAt("/restaurants?q=pizza&sort=rating");

  expect(await main().findByText("No restaurants match")).toBeDefined();
  await userEvent.click(main().getByRole("button", { name: "Clear filters" }));

  expect(await main().findByText("3 restaurants")).toBeDefined();
  expect(router.state.location.search).toBe("?sort=rating");
  expect((main().getByLabelText("Sort by") as HTMLSelectElement).value).toBe("rating");
});

test("clearing the filters keeps the table looked for: its day, time and party", async () => {
  fakeApi();
  const router = renderAt(
    "/restaurants?q=pizza&district=KENTRON&date=2026-11-14&time=20:00&guests=4",
  );

  expect(await main().findByText("No restaurants match")).toBeDefined();
  await userEvent.click(main().getByRole("button", { name: "Clear filters" }));

  expect(await main().findByText("3 restaurants")).toBeDefined();
  expect(queryOf(router)).toEqual({ date: "2026-11-14", time: "20:00", guests: "4" });
});

test("a filter the server would refuse, from a hand-edited link, is ignored", async () => {
  const fetch = fakeApi();
  renderAt("/restaurants?cuisine=PIZZA&price=9");

  expect(await main().findByText("3 restaurants")).toBeDefined();
  expect(listRequests(fetch)).toEqual(["/api/restaurants"]);
});

test("when the list can't load, Try again brings it", async () => {
  // The first try and its one automatic retry both fail.
  fakeApi(threeRestaurants, 2);
  renderAt("/restaurants");

  const retry = await main().findByRole("button", { name: "Try again" }, { timeout: 4000 });
  expect(main().getByText("We couldn’t load the restaurants.")).toBeDefined();
  await userEvent.click(retry);

  expect(await main().findByText("3 restaurants")).toBeDefined();
});

test("a long list has pages, as links that keep the filters", async () => {
  const many = Array.from({ length: 14 }, (_, n) =>
    restaurant(`place-${n + 10}`, `Place ${n + 10}`, "KENTRON"),
  );
  const fetch = fakeApi(many);
  const router = renderAt("/restaurants?district=KENTRON");

  expect(await main().findByText("Page 1 of 2")).toBeDefined();
  const next = main().getByRole("link", { name: "Next" });
  expect(next.getAttribute("href")).toBe("/restaurants?district=KENTRON&page=2");
  await userEvent.click(next);

  expect(await main().findByText("Page 2 of 2")).toBeDefined();
  expect(cardNames()).toEqual(["Place 22", "Place 23"]);
  expect(router.state.location.search).toBe("?district=KENTRON&page=2");
  await waitFor(() =>
    expect(listRequests(fetch).at(-1)).toBe("/api/restaurants?district=KENTRON&page=2"),
  );
});
