// @vitest-environment jsdom
// My favorites, through the real routes, guard, shell and hooks, with a fake API.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Mock } from "vitest";

import { sampleRestaurants } from "@/features/design/samples";
import { routes } from "@/router";
import type { AuthUser, RestaurantSummary } from "@/types/api";

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

// Lilit's favorites, the last saved first: Nurr, then Lori Smokehouse.
const nurr = sampleRestaurants[2]!;
const lori = sampleRestaurants[1]!;

/** The API, for a signed-in user, remembering what they save and take out. */
function fakeApi(user: AuthUser = lilit): Mock {
  let saved: RestaurantSummary[] = [nurr, lori];
  const fetch = vi.fn((url: string, init?: RequestInit) => {
    if (url === "/api/me") return Promise.resolve(json({ user }));
    if (url === "/api/favorites" || url.startsWith("/api/favorites?")) {
      const page = Number(new URLSearchParams(url.split("?")[1]).get("page") ?? 1);
      return Promise.resolve(
        json({ data: page === 1 ? saved : [], meta: { page, pageSize: 12, total: saved.length } }),
      );
    }
    const slug = url.match(/^\/api\/favorites\/(.+)$/)?.[1];
    if (slug && init?.method === "DELETE") {
      saved = saved.filter((one) => one.slug !== slug);
      return Promise.resolve(json({ saved: false }));
    }
    if (slug && init?.method === "PUT") {
      // Saved again, it's the last saved, so it comes first, as the server lists them.
      const restaurant = [nurr, lori].find((one) => one.slug === slug)!;
      saved = [restaurant, ...saved.filter((one) => one.slug !== slug)];
      return Promise.resolve(json({ saved: true }));
    }
    return new Promise(() => {});
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const calls = (fetch: Mock): string[] =>
  fetch.mock.calls
    .filter(([url]) => String(url).startsWith("/api/favorites"))
    .map(([url, init]) => `${(init as RequestInit | undefined)?.method ?? "GET"} ${String(url)}`);

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
    .queryAllByRole("article")
    .map((card: HTMLElement) => within(card).getByRole("heading").textContent ?? "");

test("a guest sees the restaurants they saved, the last saved first", async () => {
  const fetch = fakeApi();
  renderAt("/favorites");

  await waitFor(() => expect(cardNames()).toEqual(["Nurr", "Lori Smokehouse"]));
  expect(document.title).toBe("My favorites · Seghan");
  expect(main().getByRole("heading", { level: 1 }).textContent).toBe("My favorites");
  expect(calls(fetch)).toEqual(["GET /api/favorites"]);
});

test("taking one out sends it, the list is asked for again, and Undo saves it again, at the top", async () => {
  const fetch = fakeApi();
  renderAt("/favorites");

  await userEvent.click(await main().findByRole("button", { name: "Saved Lori Smokehouse" }));

  expect((await main().findByRole("status")).textContent).toBe(
    "Removed Lori Smokehouse from your favorites. Undo",
  );
  await waitFor(() => expect(cardNames()).toEqual(["Nurr"]));

  await userEvent.click(main().getByRole("button", { name: "Undo" }));

  await waitFor(() =>
    expect(main().getByRole("status").textContent).toBe(
      "Lori Smokehouse is back in your favorites.",
    ),
  );
  await waitFor(() => expect(cardNames()).toEqual(["Lori Smokehouse", "Nurr"]));
  expect(calls(fetch)).toEqual([
    "GET /api/favorites",
    "DELETE /api/favorites/lori-smokehouse",
    "GET /api/favorites",
    "PUT /api/favorites/lori-smokehouse",
    "GET /api/favorites",
  ]);
});

test("the page comes from the address", async () => {
  const fetch = fakeApi();
  renderAt("/favorites?page=2");

  await waitFor(() => expect(calls(fetch)).toEqual(["GET /api/favorites?page=2"]));
  expect(await main().findByText("This page is empty")).toBeDefined();
});

test("an owner is told the page is for guests, and nothing is asked for", async () => {
  const fetch = fakeApi(ani);
  renderAt("/favorites");

  await waitFor(() => expect(document.title).toBe("This page is for guests · Seghan"));
  expect(calls(fetch)).toEqual([]);
});

test("a guest's main links lead here", async () => {
  fakeApi();
  renderAt("/favorites");

  const links = within(await screen.findByRole("navigation", { name: "Main" }));
  await waitFor(() => expect(links.getByRole("link", { name: "My favorites" })).toBeDefined());
  expect(links.getByRole("link", { name: "My favorites" }).getAttribute("aria-current")).toBe(
    "page",
  );
});
