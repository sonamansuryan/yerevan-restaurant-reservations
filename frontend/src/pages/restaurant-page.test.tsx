// @vitest-environment jsdom
// A restaurant's page, through the real routes, shell and hooks, with a fake API.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Mock } from "vitest";

import { tsiranPage } from "@/features/design/samples";
import { routes } from "@/router";

type TestRouter = ReturnType<typeof createMemoryRouter>;

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status });

/**
 * Answers like the API, with Tsiran Wine Room as the only restaurant. `failures` makes that many
 * requests for its page fail first, as with no connection.
 */
function fakeApi(failures = 0): Mock {
  let failuresLeft = failures;
  const fetch = vi.fn((url: string) => {
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
      return Promise.resolve(
        json(
          {
            error: { code: "RESTAURANT_NOT_FOUND", message: "We couldn’t find this restaurant." },
          },
          404,
        ),
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

const pageRequests = (fetch: Mock): string[] =>
  fetch.mock.calls.map(([url]) => String(url)).filter((url) => url.startsWith("/api/restaurants/"));

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
  fakeApi(2);
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
