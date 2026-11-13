// @vitest-environment jsdom
// Seghan's analytics (9.6), on an owner's dashboard and in the admin area, through the real routes,
// guards, shell and hooks, with a fake API.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Mock } from "vitest";

import { loriAnalytics, ownedLori, seghanAnalytics } from "@/features/design/samples";
import { routes } from "@/router";
import type { AuthUser } from "@/types/api";

type TestRouter = ReturnType<typeof createMemoryRouter>;

const json = (body: unknown, status = 200): Promise<Response> =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

const ani: AuthUser = {
  id: "user-ani",
  email: "ani.owner@example.com",
  name: "Ani Sargsyan",
  phone: null,
  role: "OWNER",
};
const nare: AuthUser = { ...ani, id: "user-admin", name: "Demo Admin", role: "ADMIN" };
const lilit: AuthUser = { ...ani, id: "user-lilit", name: "Lilit Harutyunyan", role: "CUSTOMER" };

const LORI = `/dashboard/${ownedLori.id}`;

/** The API for whoever is signed in: Ani's Lori Smokehouse, and the numbers for any period. */
function fakeApi(user: AuthUser): Mock {
  const fetch = vi.fn((url: string) => {
    if (url === "/api/me") return json({ user });
    if (url === "/api/auth/refresh") return json({ error: { code: "UNAUTHORIZED" } }, 401);
    if (url === `/api/owner/restaurants/${ownedLori.id}`) return json({ restaurant: ownedLori });
    const owners = /^\/api\/owner\/restaurants\/[^/]+\/analytics\?days=(7|30|90)$/.exec(url);
    if (owners) return json({ analytics: loriAnalytics[Number(owners[1]) as 7 | 30 | 90] });
    if (/^\/api\/admin\/analytics\?days=(7|30|90)$/.test(url)) {
      return json({ analytics: seghanAnalytics });
    }
    // Anything else, such as the day's bookings, never answers here.
    return new Promise(() => {});
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const analyticsCalls = (fetch: Mock): string[] =>
  fetch.mock.calls.map(([url]) => String(url)).filter((url) => url.includes("analytics"));

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
const period = (): string | null => main().getByRole("status").textContent;

describe("on the dashboard", () => {
  test("the owner opens Analytics, the last of the restaurant's parts, and sees the last 30 days", async () => {
    const fetch = fakeApi(ani);
    const router = renderAt(LORI);

    const parts = within(await main().findByRole("navigation", { name: "Lori Smokehouse" }));
    expect(parts.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Reservations",
      "Tables",
      "Opening hours",
      "Blocked times",
      "Restaurant info",
      "Photos",
      "Analytics",
    ]);
    await userEvent.click(parts.getByRole("link", { name: "Analytics" }));

    expect(router.state.location.pathname).toBe(`${LORI}/analytics`);
    await waitFor(() => expect(document.title).toBe("Analytics · Lori Smokehouse · Seghan"));
    await waitFor(() => expect(period()).toContain("13 October – 11 November"));
    expect(main().getByRole("heading", { level: 2, name: "Analytics" })).toBeDefined();
    expect(analyticsCalls(fetch)).toEqual([
      `/api/owner/restaurants/${ownedLori.id}/analytics?days=30`,
    ]);
  });

  test("another period goes into the address and the request, and Back brings the last one", async () => {
    const fetch = fakeApi(ani);
    const router = renderAt(`${LORI}/analytics`);
    await waitFor(() => expect(period()).toContain("13 October"));

    await userEvent.selectOptions(main().getByLabelText("Period"), "The last 7 days");

    expect(router.state.location.search).toBe("?days=7");
    await waitFor(() => expect(period()).toContain("5 November – 11 November"));
    expect(analyticsCalls(fetch)).toEqual([
      `/api/owner/restaurants/${ownedLori.id}/analytics?days=30`,
      `/api/owner/restaurants/${ownedLori.id}/analytics?days=7`,
    ]);

    await router.navigate(-1);

    await waitFor(() => expect(period()).toContain("13 October – 11 November"));
  });

  test("a period in a shared link is the one asked for", async () => {
    const fetch = fakeApi(ani);
    renderAt(`${LORI}/analytics?days=90`);

    await waitFor(() => expect(period()).toContain("14 August – 11 November"));
    expect((main().getByLabelText("Period") as HTMLSelectElement).value).toBe("90");
    expect(analyticsCalls(fetch)).toEqual([
      `/api/owner/restaurants/${ownedLori.id}/analytics?days=90`,
    ]);
  });

  test("a guest is told the page is for restaurants, and nothing is counted", async () => {
    const fetch = fakeApi(lilit);
    renderAt(`${LORI}/analytics`);

    await waitFor(() => expect(document.title).toBe("This page is for restaurants · Seghan"));
    expect(analyticsCalls(fetch)).toEqual([]);
  });
});

describe("in the admin area", () => {
  test("an admin opens Analytics after Reservations: all of Seghan, and the most booked", async () => {
    const fetch = fakeApi(nare);
    const router = renderAt("/admin");

    const parts = within(await main().findByRole("navigation", { name: "Admin" }));
    expect(parts.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Restaurants",
      "Reservations",
      "Analytics",
      "Users",
    ]);
    await userEvent.click(parts.getByRole("link", { name: "Analytics" }));

    expect(router.state.location.pathname).toBe("/admin/analytics");
    await waitFor(() => expect(document.title).toBe("Analytics · Admin · Seghan"));
    const mostBooked = (await main().findByRole("heading", { name: "Most booked" })).closest(
      "section",
    ) as HTMLElement;
    expect(within(mostBooked).getAllByRole("listitem")[0]?.textContent).toBe("Lori Smokehouse21");
    expect(analyticsCalls(fetch)).toEqual(["/api/admin/analytics?days=30"]);
  });

  test("an owner is told the page is for Seghan’s team, and nothing is counted", async () => {
    const fetch = fakeApi(ani);
    renderAt("/admin/analytics?days=7");

    await waitFor(() => expect(document.title).toBe("This page is for Seghan’s team · Seghan"));
    expect(analyticsCalls(fetch)).toEqual([]);
  });
});
