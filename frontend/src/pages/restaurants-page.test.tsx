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
import type { District, RestaurantSummary } from "@/types/api";

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
});

const threeRestaurants = [
  restaurant("kond-house", "Kond House", "KENTRON"),
  restaurant("lori-smokehouse", "Lori Smokehouse", "ARABKIR"),
  restaurant("nurr", "Nurr", "KENTRON"),
];

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status });

/**
 * Answers like the API: nobody is signed in, and /api/restaurants filters by district and search,
 * 12 to a page. `failures` makes that many list requests fail first, as with no connection.
 */
function fakeApi(list: RestaurantSummary[] = threeRestaurants, failures = 0): Mock {
  let failuresLeft = failures;
  const fetch = vi.fn((url: string) => {
    const { pathname, searchParams } = new URL(url, "http://seghan.test");
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

/** The addresses Browse asked the API for, in order. */
const listRequests = (fetch: Mock): string[] =>
  fetch.mock.calls.map(([url]) => String(url)).filter((url) => url.startsWith("/api/restaurants"));

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

test("a search runs when it's sent, and Back undoes it", async () => {
  fakeApi();
  const router = renderAt("/restaurants");
  await main().findByText("3 restaurants");

  await userEvent.type(main().getByLabelText("Search"), "lori{Enter}");
  expect(await main().findByText("1 restaurant")).toBeDefined();
  expect(router.state.location.search).toBe("?q=lori");

  await router.navigate(-1);
  expect(await main().findByText("3 restaurants")).toBeDefined();
  // The search box follows the address back.
  expect((main().getByLabelText("Search") as HTMLInputElement).value).toBe("");
});

test("nothing found has one way out: clearing the filters", async () => {
  fakeApi();
  const router = renderAt("/restaurants?q=pizza&district=KENTRON");

  expect(await main().findByText("No restaurants match")).toBeDefined();
  await userEvent.click(main().getByRole("button", { name: "Clear filters" }));

  expect(await main().findByText("3 restaurants")).toBeDefined();
  expect(router.state.location.search).toBe("");
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
