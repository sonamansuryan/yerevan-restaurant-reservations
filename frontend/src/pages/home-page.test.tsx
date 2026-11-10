// @vitest-environment jsdom
// The home page, through the real routes, shell and hooks, with a fake API.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Mock } from "vitest";

import { sampleRestaurants } from "@/features/design/samples";
import { routes } from "@/router";

type TestRouter = ReturnType<typeof createMemoryRouter>;

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status });

/** Answers like the API, with the six demo restaurants, searched by name and paged. */
function fakeApi(): Mock {
  const fetch = vi.fn((url: string) => {
    const { pathname, searchParams } = new URL(url, "http://seghan.test");
    if (pathname === "/api/restaurants") {
      const q = searchParams.get("q")?.toLowerCase();
      const pageSize = Number(searchParams.get("pageSize") ?? 12);
      const found = sampleRestaurants.filter((r) => !q || r.name.toLowerCase().includes(q));
      return Promise.resolve(
        json({
          data: found.slice(0, pageSize),
          meta: { page: 1, pageSize, total: found.length },
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

test("leads with the agreed headline, Seghan in wine italic, and says what the name means", async () => {
  fakeApi();
  renderAt("/");

  const headline = await main().findByRole("heading", { level: 1 });
  expect(headline.textContent).toBe("Choose your Seghan.");
  expect(headline.querySelector("em")?.textContent).toBe("Seghan.");
  expect(
    main().getByText("Seghan means table in Armenian. Find yours at restaurants across the city."),
  ).toBeDefined();
});

test("shows three restaurants, asking for only three, and links to all of them", async () => {
  const fetch = fakeApi();
  renderAt("/");

  expect(await main().findByRole("link", { name: "Kond House" })).toBeDefined();
  const cards = main()
    .getAllByRole("heading", { level: 3 })
    .map((heading: HTMLElement) => heading.textContent);
  expect(cards).toEqual(["Kond House", "Lori Smokehouse", "Nurr"]);
  expect(fetch.mock.calls.map(([url]) => String(url))).toContain("/api/restaurants?pageSize=3");
  expect(main().getByRole("link", { name: "See all 6 restaurants" }).getAttribute("href")).toBe(
    "/restaurants",
  );
});

test("a search lands on Browse, with the box filled and the list found", async () => {
  fakeApi();
  const router = renderAt("/");

  await userEvent.type(await main().findByLabelText("Search restaurants"), "nurr{Enter}");

  expect(await main().findByText("1 restaurant")).toBeDefined();
  expect(router.state.location.pathname).toBe("/restaurants");
  expect(router.state.location.search).toBe("?q=nurr");
  expect((main().getByLabelText("Search") as HTMLInputElement).value).toBe("nurr");
});

test("a card opens the restaurant's own page", async () => {
  fakeApi();
  const router = renderAt("/");

  await userEvent.click(await main().findByRole("link", { name: "Lori Smokehouse" }));

  expect(router.state.location.pathname).toBe("/restaurants/lori-smokehouse");
});

test("an evening over Yerevan follows the search, and screen readers hear only its caption", async () => {
  fakeApi();
  renderAt("/");

  const hero = (await main().findByRole("heading", { level: 1 })).closest("section");
  const scene = within(hero as HTMLElement).getByRole("figure", {
    name: "Ararat at dusk, from Yerevan",
  });
  expect(scene.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  // On narrower screens it sits under the search, so the search stays first.
  const search = within(hero as HTMLElement).getByRole("search");
  expect(search.compareDocumentPosition(scene) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
