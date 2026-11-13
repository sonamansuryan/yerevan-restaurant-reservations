// @vitest-environment jsdom
// Seghan's admin area, through the real routes, guard, shell and hooks, with a fake API.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Mock } from "vitest";

import {
  adminReservations,
  adminRestaurants,
  adminUsers,
  hiddenTbilisi,
} from "@/features/design/samples";
import { routes } from "@/router";
import type { AdminRestaurant, AuthUser } from "@/types/api";

type TestRouter = ReturnType<typeof createMemoryRouter>;

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status });
const page = <T,>(data: T[]) => ({ data, meta: { page: 1, pageSize: 20, total: data.length } });

const nare: AuthUser = {
  id: "user-admin",
  email: "admin@example.com",
  name: "Demo Admin",
  phone: null,
  role: "ADMIN",
};
const lilit: AuthUser = { ...nare, id: "user-lilit", name: "Lilit Harutyunyan", role: "CUSTOMER" };
const ani: AuthUser = { ...nare, id: "user-ani", name: "Ani Sargsyan", role: "OWNER" };

/** The API for whoever is signed in, or nobody, remembering what Seghan hides and shows. */
function fakeApi(user: AuthUser | null = nare): Mock {
  let restaurants: AdminRestaurant[] = [...adminRestaurants];
  const fetch = vi.fn((url: string, init?: RequestInit) => {
    if (url === "/api/me") {
      return Promise.resolve(
        user ? json({ user }) : json({ error: { code: "UNAUTHORIZED" } }, 401),
      );
    }
    if (url === "/api/auth/refresh") {
      return Promise.resolve(json({ error: { code: "UNAUTHORIZED" } }, 401));
    }
    if (url.startsWith("/api/admin/restaurants?") || url === "/api/admin/restaurants") {
      return Promise.resolve(json(page(restaurants)));
    }
    const id = /^\/api\/admin\/restaurants\/(.+)$/.exec(url)?.[1];
    if (id && init?.method === "PATCH") {
      const { hidden } = JSON.parse(String(init.body)) as { hidden: boolean };
      restaurants = restaurants.map((one) =>
        one.id === id ? { ...one, hiddenAt: hidden ? "2026-11-12T08:00:00.000Z" : null } : one,
      );
      return Promise.resolve(json({ restaurant: restaurants.find((one) => one.id === id) }));
    }
    if (url.startsWith("/api/admin/reservations"))
      return Promise.resolve(json(page(adminReservations)));
    if (url.startsWith("/api/admin/users")) return Promise.resolve(json(page(adminUsers)));
    return new Promise(() => {});
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const adminCalls = (fetch: Mock): string[] =>
  fetch.mock.calls
    .filter(([url]) => String(url).startsWith("/api/admin"))
    .map(([url, init]) => `${(init as RequestInit | undefined)?.method ?? "GET"} ${String(url)}`);

beforeEach(() => {
  // jsdom has no scrollTo(), which ScrollRestoration calls.
  window.scrollTo = vi.fn();
  // jsdom has no showModal(), which Modal uses. These open and close it the simple way.
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
const line = (name: string): HTMLElement =>
  main().getByText(name, { selector: "p" }).closest("li") as HTMLElement;

describe("who may", () => {
  test("an admin reaches it from the header, and Restaurants open first", async () => {
    const fetch = fakeApi();
    const router = renderAt("/");

    const links = within(screen.getByRole("navigation", { name: "Main" }));
    await userEvent.click(await links.findByRole("link", { name: "Admin" }));

    expect(router.state.location.pathname).toBe("/admin");
    await waitFor(() => expect(document.title).toBe("Restaurants · Admin · Seghan"));
    expect(main().getByRole("heading", { level: 1 }).textContent).toBe("Admin");
    const parts = within(main().getByRole("navigation", { name: "Admin" }));
    expect(parts.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Restaurants",
      "Reservations",
      "Analytics",
      "Users",
    ]);
    expect(await main().findByText("6 restaurants")).toBeDefined();
    expect(adminCalls(fetch)).toEqual(["GET /api/admin/restaurants"]);
  });

  test.each([
    ["a guest", lilit],
    ["an owner", ani],
  ])("%s is told the page is for Seghan’s team, and nothing is asked for", async (_who, user) => {
    const fetch = fakeApi(user);
    renderAt("/admin/users");

    await waitFor(() => expect(document.title).toBe("This page is for Seghan’s team · Seghan"));
    expect(main().getByText(`You’re signed in as ${user.name}.`)).toBeDefined();
    expect(adminCalls(fetch)).toEqual([]);
    expect(
      within(screen.getByRole("navigation", { name: "Main" })).queryByRole("link", {
        name: "Admin",
      }),
    ).toBeNull();
  });

  test("someone signed out is sent to Sign in, and comes back afterwards", async () => {
    const fetch = fakeApi(null);
    const router = renderAt("/admin/reservations");

    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(router.state.location.state).toMatchObject({
      from: { pathname: "/admin/reservations" },
    });
    expect(adminCalls(fetch)).toEqual([]);
  });
});

describe("restaurants", () => {
  test("hiding one asks first, sends it, says so, and its line says Hidden by Seghan", async () => {
    const fetch = fakeApi();
    renderAt("/admin");

    await userEvent.click(await main().findByRole("button", { name: "Hide Lori Smokehouse" }));
    await userEvent.click(
      within(screen.getByRole("dialog", { name: "Hide this restaurant?" })).getByRole("button", {
        name: "Hide restaurant",
      }),
    );

    const notice = await main().findByText(
      "Lori Smokehouse is hidden. Guests can’t find or book it until you show it again.",
    );
    expect(document.activeElement?.contains(notice)).toBe(true);
    await waitFor(() =>
      expect(within(line("Lori Smokehouse")).getByText("Hidden by Seghan")).toBeDefined(),
    );
    expect(adminCalls(fetch)).toEqual([
      "GET /api/admin/restaurants",
      `PATCH /api/admin/restaurants/${adminRestaurants[1]!.id}`,
      // Asked for again, since it may have moved between the lists.
      "GET /api/admin/restaurants",
    ]);
    const patch = fetch.mock.calls.find(([, init]) => init?.method === "PATCH")!;
    expect(JSON.parse(String(patch[1]!.body))).toEqual({ hidden: true });
  });

  test("Show again sends it at once", async () => {
    const fetch = fakeApi();
    renderAt("/admin?show=hidden");

    await userEvent.click(
      await main().findByRole("button", { name: "Show Tbilisi Courtyard again" }),
    );

    expect(
      await main().findByText(
        "Tbilisi Courtyard is shown again. Guests can find it and book a table.",
      ),
    ).toBeDefined();
    const patch = fetch.mock.calls.find(([, init]) => init?.method === "PATCH")!;
    expect(patch[0]).toBe(`/api/admin/restaurants/${hiddenTbilisi.id}`);
    expect(JSON.parse(String(patch[1]!.body))).toEqual({ hidden: false });
  });

  test("the filters live in the address, and go to the API as they are", async () => {
    const fetch = fakeApi();
    const router = renderAt("/admin?q=lori&show=published");

    expect(await main().findByRole("searchbox", { name: "Search" })).toHaveProperty(
      "value",
      "lori",
    );
    await userEvent.selectOptions(main().getByLabelText("Show"), "Drafts");

    expect(router.state.location.search).toBe("?q=lori&show=draft");
    await waitFor(() =>
      expect(adminCalls(fetch)).toEqual([
        "GET /api/admin/restaurants?q=lori&show=published",
        "GET /api/admin/restaurants?q=lori&show=draft",
      ]),
    );
  });
});

describe("reservations and users", () => {
  test("every booking, with its filters from the address", async () => {
    const fetch = fakeApi();
    renderAt("/admin/reservations?status=NO_SHOW&date=2026-11-14&q=lori");

    expect(await main().findByText("5 bookings")).toBeDefined();
    expect(document.title).toBe("Reservations · Admin · Seghan");
    expect(adminCalls(fetch)).toEqual([
      "GET /api/admin/reservations?q=lori&status=NO_SHOW&date=2026-11-14",
    ]);
  });

  test("everyone, and the role filter changes the address and the request", async () => {
    const fetch = fakeApi();
    const router = renderAt("/admin/users");

    expect(await main().findByText("6 users")).toBeDefined();
    await userEvent.selectOptions(main().getByLabelText("Role"), "Owners");

    expect(router.state.location.search).toBe("?role=OWNER");
    await waitFor(() =>
      expect(adminCalls(fetch)).toEqual([
        "GET /api/admin/users",
        "GET /api/admin/users?role=OWNER",
      ]),
    );
  });
});
