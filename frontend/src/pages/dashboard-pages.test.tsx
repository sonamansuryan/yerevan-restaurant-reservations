// @vitest-environment jsdom
// The owner's dashboard through the real routes, shell, guard and hooks, with a fake API.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Mock } from "vitest";

import { clockTime } from "@/features/dashboard/hours";
import type { Opening } from "@/features/dashboard/hours";
import {
  fridayBookings,
  ownedDraft,
  ownedLori,
  ownedRestaurants,
  ownedTables,
  sampleBlocks,
  samplePhotos,
  tsiranPage,
} from "@/features/design/samples";
import { shiftDate } from "@/lib/time";
import { routes } from "@/router";
import type { AuthUser, OwnerBlock, OwnerRestaurant, OwnerTable } from "@/types/api";

type TestRouter = ReturnType<typeof createMemoryRouter>;

const ani: AuthUser = {
  id: "owner-1",
  email: "ani@example.com",
  name: "Ani Sargsyan",
  phone: null,
  role: "OWNER",
};

const LORI = `/api/owner/restaurants/${ownedLori.id}`;
const NEW_ID = "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a";

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status });
const refusal = (status: number, code: string, message: string, details?: unknown): Response =>
  json({ error: { code, message, details } }, status);

interface FakeOptions {
  restaurants?: OwnerRestaurant[];
  /** The restaurant at Lori's address. */
  lori?: OwnerRestaurant;
  /** What publishing answers, if not a success. */
  publishing?: Response;
  /** Lori's tables and blocks. Changes to them are kept, so a list fetched again shows them. */
  tables?: OwnerTable[];
  blocks?: OwnerBlock[];
  /** What switching a table off or on answers, if not a success. */
  tableSwitch?: Response;
  /** What adding a block answers, if not a success. */
  blocking?: Response;
}

/**
 * Answers like the API for Ani, an owner. Lori Smokehouse is hers; any other id is someone
 * else's (404), and an address that isn't an id is refused (400).
 */
function fakeApi({
  restaurants = ownedRestaurants,
  lori = ownedLori,
  publishing,
  tables = ownedTables,
  blocks = [],
  tableSwitch,
  blocking,
}: FakeOptions = {}): Mock {
  let created: OwnerRestaurant | null = null;
  let tablesNow = [...tables];
  let blocksNow = [...blocks];
  const list = <T,>(data: T[]): Response =>
    json({ data, meta: { page: 1, pageSize: 100, total: data.length } });
  const fetch = vi.fn((url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body: unknown = init?.body ? JSON.parse(String(init.body)) : undefined;
    if (url === "/api/me") return Promise.resolve(json({ user: ani }));
    if (url === "/api/owner/restaurants" && method === "GET") {
      return Promise.resolve(
        json({ data: restaurants, meta: { page: 1, pageSize: 48, total: restaurants.length } }),
      );
    }
    if (url === "/api/owner/restaurants" && method === "POST") {
      created = { ...ownedDraft, ...(body as object), id: NEW_ID, slug: "new-place" };
      return Promise.resolve(json({ restaurant: created }, 201));
    }
    if (url === `/api/owner/restaurants/${NEW_ID}` && created) {
      return Promise.resolve(json({ restaurant: created }));
    }
    if (url === LORI && method === "GET") return Promise.resolve(json({ restaurant: lori }));
    if (url === LORI && method === "PATCH") {
      if (publishing && typeof body === "object" && body && "isPublished" in body) {
        return Promise.resolve(publishing);
      }
      return Promise.resolve(json({ restaurant: { ...lori, ...(body as object) } }));
    }
    if (url.startsWith(`${LORI}/reservations?`)) {
      return Promise.resolve(
        json({
          data: fridayBookings,
          meta: { page: 1, pageSize: 100, total: fridayBookings.length },
        }),
      );
    }
    if (url === `${LORI}/opening-hours` && method === "GET") {
      return Promise.resolve(json({ openingHours: tsiranPage.openingHours }));
    }
    if (url === `${LORI}/opening-hours` && method === "PUT") {
      const { hours } = body as { hours: Opening[] };
      const week = hours.map((opening) => ({
        ...opening,
        opens: clockTime(opening.opensAt),
        closes: clockTime(opening.closesAt),
      }));
      return Promise.resolve(json({ openingHours: week }));
    }
    if (url === `${LORI}/photos`) return Promise.resolve(json({ photos: samplePhotos }));
    if (url === `${LORI}/tables` && method === "GET") return Promise.resolve(list(tablesNow));
    if (url === `${LORI}/tables` && method === "POST") {
      const table = { id: "table-new", isActive: true, ...(body as object) } as OwnerTable;
      tablesNow = [...tablesNow, table];
      return Promise.resolve(json({ table }, 201));
    }
    if (url.startsWith(`${LORI}/tables/`) && method === "PATCH") {
      const change = body as Partial<OwnerTable>;
      if (tableSwitch && "isActive" in change) return Promise.resolve(tableSwitch);
      const id = url.slice(`${LORI}/tables/`.length);
      tablesNow = tablesNow.map((table) => (table.id === id ? { ...table, ...change } : table));
      return Promise.resolve(json({ table: tablesNow.find((table) => table.id === id) }));
    }
    if (url === `${LORI}/blocks` && method === "GET") return Promise.resolve(list(blocksNow));
    if (url === `${LORI}/blocks` && method === "POST") {
      if (blocking) return Promise.resolve(blocking);
      const { date } = body as { date: string };
      const block: OwnerBlock = {
        id: "block-new",
        table: null,
        startsAt: `${date}T00:00:00.000Z`,
        endsAt: `${shiftDate(date, 1)}T00:00:00.000Z`,
        starts: { date, time: "00:00" },
        ends: { date: shiftDate(date, 1), time: "00:00" },
        reason: null,
      };
      blocksNow = [...blocksNow, block];
      return Promise.resolve(json({ block }, 201));
    }
    if (url.startsWith(`${LORI}/blocks/`) && method === "DELETE") {
      const id = url.slice(`${LORI}/blocks/`.length);
      blocksNow = blocksNow.filter((block) => block.id !== id);
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    if (/^\/api\/owner\/restaurants\/[\da-f-]{36}(\/|$)/.test(url)) {
      return Promise.resolve(
        refusal(404, "RESTAURANT_NOT_FOUND", "We couldn’t find this restaurant."),
      );
    }
    if (url.startsWith("/api/owner/restaurants/")) {
      return Promise.resolve(
        refusal(400, "VALIDATION_ERROR", "The request is invalid.", {
          fields: { restaurantId: "Choose a restaurant." },
        }),
      );
    }
    return new Promise(() => {});
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const requests = (fetch: Mock): string[] => fetch.mock.calls.map(([url]) => String(url));

/** The body of the first request sent with that method to that address. */
function sent(fetch: Mock, method: string, url: string): unknown {
  const call = fetch.mock.calls.find(
    ([to, init]) => to === url && (init as RequestInit | undefined)?.method === method,
  );
  return call ? JSON.parse(String((call[1] as RequestInit).body)) : undefined;
}

beforeEach(() => {
  // Friday 13 November 2026, 14:00 in Yerevan. Only the date is fixed: timers stay real.
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-13T10:00:00Z") });
  // jsdom has no scrollTo(), which ScrollRestoration calls.
  window.scrollTo = vi.fn();
  // Nor showModal(), which Modal uses. These open and close it the simple way.
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
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

describe("your restaurants", () => {
  test("each of the owner's restaurants opens its own dashboard", async () => {
    fakeApi();
    renderAt("/dashboard");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Your restaurants" }),
    ).toBeDefined();
    const lori = await screen.findByRole("link", { name: /Lori Smokehouse/ });
    expect(lori.getAttribute("href")).toBe(`/dashboard/${ownedLori.id}`);
    expect(screen.getByRole("link", { name: "Add a restaurant" }).getAttribute("href")).toBe(
      "/dashboard/new",
    );
  });

  test("an owner with none is offered to add one", async () => {
    fakeApi({ restaurants: [] });
    const router = renderAt("/dashboard");

    await userEvent.click(await screen.findByRole("button", { name: "Add a restaurant" }));

    expect(router.state.location.pathname).toBe("/dashboard/new");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Add a restaurant" }),
    ).toBeDefined();
  });

  test("a new restaurant opens on its information, which says what comes next", async () => {
    const fetch = fakeApi();
    const router = renderAt("/dashboard/new");

    await userEvent.type(await screen.findByLabelText("Name"), "Ani's New Place");
    await userEvent.click(screen.getByLabelText("Armenian"));
    await userEvent.selectOptions(screen.getByLabelText("Price"), "֏֏ Moderate");
    await userEvent.selectOptions(screen.getByLabelText("District"), "Kentron");
    await userEvent.type(screen.getByLabelText("Address"), "1 Abovyan Street, Yerevan");
    await userEvent.click(screen.getByRole("button", { name: "Add the restaurant" }));

    expect(await screen.findByText("Restaurant added.", { exact: false })).toBeDefined();
    expect(router.state.location.pathname).toBe(`/dashboard/${NEW_ID}/information`);
    expect(sent(fetch, "POST", "/api/owner/restaurants")).toMatchObject({
      name: "Ani's New Place",
      cuisines: ["ARMENIAN"],
      district: "KENTRON",
      priceLevel: 2,
    });
    expect(screen.getByRole("link", { name: "Set opening hours" }).getAttribute("href")).toBe(
      `/dashboard/${NEW_ID}/hours`,
    );
  });
});

describe("a restaurant's dashboard", () => {
  test("it opens on today's bookings, by Yerevan's calendar", async () => {
    const fetch = fakeApi();
    renderAt(`/dashboard/${ownedLori.id}`);

    expect(await screen.findByRole("heading", { level: 1, name: "Lori Smokehouse" })).toBeDefined();
    expect(await screen.findByText("Anahit Petrosyan")).toBeDefined();
    expect(requests(fetch)).toContain(`${LORI}/reservations?date=2026-11-13&page=1`);
    expect(screen.getByRole("heading", { level: 2, name: "Friday 13 November" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Bookings" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(screen.getByText("14 guests", { exact: false })).toBeDefined();
    await waitFor(() => expect(document.title).toBe("Bookings · Lori Smokehouse · Seghan"));
  });

  test("the day is in the address, so Next day moves the book on, and Back returns", async () => {
    const fetch = fakeApi();
    const router = renderAt(`/dashboard/${ownedLori.id}?date=2026-11-13`);

    await userEvent.click(await screen.findByRole("link", { name: "Next day" }));

    expect(router.state.location.search).toBe("?date=2026-11-14");
    expect(
      await screen.findByRole("heading", { level: 2, name: "Saturday 14 November" }),
    ).toBeDefined();
    await waitFor(() =>
      expect(requests(fetch)).toContain(`${LORI}/reservations?date=2026-11-14&page=1`),
    );

    await router.navigate(-1);

    expect(
      await screen.findByRole("heading", { level: 2, name: "Friday 13 November" }),
    ).toBeDefined();
  });

  test("a date that doesn't exist means today", async () => {
    const fetch = fakeApi();
    renderAt(`/dashboard/${ownedLori.id}?date=2026-02-30`);

    await screen.findByText("Anahit Petrosyan");

    expect(requests(fetch)).toContain(`${LORI}/reservations?date=2026-11-13&page=1`);
  });

  test.each([
    ["someone else's", "/dashboard/00000000-0000-4000-8000-000000000000"],
    ["an address that isn't one", "/dashboard/not-a-restaurant"],
  ])("%s restaurant is not found, with the way back", async (_, path) => {
    fakeApi();
    renderAt(path);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Restaurant not found" }),
    ).toBeDefined();
    expect(screen.getByRole("link", { name: "Your restaurants" }).getAttribute("href")).toBe(
      "/dashboard",
    );
  });
});

describe("the restaurant's parts", () => {
  test("Information saves every detail, and the header follows", async () => {
    const fetch = fakeApi();
    renderAt(`/dashboard/${ownedLori.id}/information`);

    const name = await screen.findByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "Lori Grill");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Changes saved.")).toBeDefined();
    expect(sent(fetch, "PATCH", LORI)).toEqual({
      name: "Lori Grill",
      description: ownedLori.description,
      cuisines: ownedLori.cuisines,
      district: ownedLori.district,
      address: ownedLori.address,
      phone: ownedLori.phone,
      website: null,
      priceLevel: 2,
      slotIntervalMin: 30,
      reservationDurationMin: 120,
    });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Lori Grill");
  });

  test("publishing too early says what's missing, in the server's words", async () => {
    const fetch = fakeApi({
      lori: { ...ownedLori, isPublished: false },
      publishing: refusal(
        409,
        "NOT_READY_TO_PUBLISH",
        "Add at least one table before you publish.",
        { missing: ["TABLE"] },
      ),
    });
    renderAt(`/dashboard/${ownedLori.id}/information`);

    await userEvent.click(await screen.findByRole("button", { name: "Publish" }));

    expect(await screen.findByText("Add at least one table before you publish.")).toBeDefined();
    expect(sent(fetch, "PATCH", LORI)).toEqual({ isPublished: true });
  });

  test("Opening hours shows the saved week, and Save sends it whole", async () => {
    const fetch = fakeApi();
    renderAt(`/dashboard/${ownedLori.id}/hours`);

    const friday = await screen.findByRole("group", { name: "Friday" });
    const closes = within(friday).getByLabelText("Closes") as HTMLSelectElement;
    expect(closes.selectedOptions[0]?.textContent).toBe("02:00 (next day)");

    await userEvent.click(screen.getByRole("button", { name: "Remove, Friday 18:00 to 02:00" }));
    await userEvent.click(screen.getByRole("button", { name: "Save opening hours" }));

    expect(await screen.findByText("Opening hours saved.")).toBeDefined();
    const { hours } = sent(fetch, "PUT", `${LORI}/opening-hours`) as { hours: Opening[] };
    expect(hours).toHaveLength(tsiranPage.openingHours.length - 1);
    expect(hours).toContainEqual({ dayOfWeek: 6, opensAt: 1080, closesAt: 1560 });
    expect(within(friday).getByText("Closed")).toBeDefined();
  });

  test("Photos shows the cover first", async () => {
    fakeApi();
    renderAt(`/dashboard/${ownedLori.id}/photos`);

    expect(await screen.findByRole("img", { name: "Lori Smokehouse, cover photo" })).toBeDefined();
    expect(screen.getByText("5 of 10 photos.", { exact: false })).toBeDefined();
  });
});

describe("tables and blocked times", () => {
  const tablesPage = `/dashboard/${ownedLori.id}/tables`;
  const blocksPage = `/dashboard/${ownedLori.id}/blocks`;

  test("Tables lists the tables by area, with what can be booked at a glance", async () => {
    fakeApi();
    renderAt(tablesPage);

    expect(await screen.findByText("7 tables, 37 seats · 1 inactive")).toBeDefined();
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(["Indoor", "Terrace", "VIP", "Bar counter"]);
    expect(screen.getByRole("link", { name: "Tables" }).getAttribute("aria-current")).toBe("page");
    await waitFor(() => expect(document.title).toBe("Tables · Lori Smokehouse · Seghan"));
  });

  test("adding a table sends it, closes the form, and shows it in its area", async () => {
    const fetch = fakeApi();
    renderAt(tablesPage);

    await userEvent.click(await screen.findByRole("button", { name: "Add a table" }));
    const form = screen.getByRole("dialog", { name: "Add a table" });
    await userEvent.type(within(form).getByLabelText("Name"), "T7");
    await userEvent.selectOptions(within(form).getByLabelText("Seats"), "6");
    await userEvent.selectOptions(within(form).getByLabelText("Fewest guests"), "3");
    await userEvent.selectOptions(within(form).getByLabelText("Area"), "Terrace");
    await userEvent.click(within(form).getByRole("button", { name: "Add the table" }));

    expect(await screen.findByRole("button", { name: "Edit T7" })).toBeDefined();
    expect(sent(fetch, "POST", `${LORI}/tables`)).toEqual({
      label: "T7",
      capacity: 6,
      minCapacity: 3,
      zone: "TERRACE",
    });
    expect((form as HTMLDialogElement).open).toBe(false);
  });

  test("switching off a table that bookings need shows them under its line", async () => {
    const fetch = fakeApi({
      tableSwitch: refusal(
        409,
        "TABLE_HAS_BOOKINGS",
        "An upcoming booking still needs this table. You can deactivate it once that booking is over or cancelled.",
        { reservations: fridayBookings.slice(0, 1) },
      ),
    });
    renderAt(tablesPage);

    await userEvent.click(await screen.findByRole("button", { name: "Deactivate T1" }));

    const t1 = screen.getByRole("button", { name: "Edit T1" }).closest("li") as HTMLElement;
    expect((await within(t1).findByRole("alert")).textContent).toContain(
      "An upcoming booking still needs this table.",
    );
    expect(within(t1).getByRole("list", { name: "Bookings in the way" }).textContent).toContain(
      "Lilit Harutyunyan",
    );
    expect(sent(fetch, "PATCH", `${LORI}/tables/table-t1`)).toEqual({ isActive: false });
  });

  test("Blocked times starts empty, and blocking a whole day sends just the date", async () => {
    const fetch = fakeApi();
    renderAt(blocksPage);

    await userEvent.click(await screen.findByRole("button", { name: "Block a time" }));
    const form = screen.getByRole("dialog", { name: "Block a time" });
    // The form starts on today, in Yerevan.
    expect((within(form).getByLabelText("Date") as HTMLInputElement).value).toBe("2026-11-13");
    fireEvent.change(within(form).getByLabelText("Date"), { target: { value: "2026-12-31" } });
    await userEvent.click(within(form).getByRole("button", { name: "Block this time" }));

    expect(await screen.findByText("Thursday 31 December")).toBeDefined();
    expect(sent(fetch, "POST", `${LORI}/blocks`)).toEqual({ date: "2026-12-31" });
    expect(screen.getByRole("link", { name: "Blocked times" }).getAttribute("aria-current")).toBe(
      "page",
    );
  });

  test("a block with bookings inside lists them in the form, and stays open", async () => {
    fakeApi({
      blocking: refusal(
        409,
        "BLOCK_HAS_BOOKINGS",
        "2 upcoming bookings fall inside this block. Choose another time, or cancel them first.",
        { reservations: fridayBookings.slice(2, 4) },
      ),
    });
    renderAt(blocksPage);

    await userEvent.click(await screen.findByRole("button", { name: "Block a time" }));
    const form = screen.getByRole("dialog", { name: "Block a time" });
    await userEvent.click(within(form).getByRole("button", { name: "Block this time" }));

    expect((await within(form).findByRole("alert")).textContent).toContain(
      "2 upcoming bookings fall inside this block.",
    );
    expect(
      within(form).getByRole("list", { name: "Bookings in the way" }).querySelectorAll("li"),
    ).toHaveLength(2);
    expect((form as HTMLDialogElement).open).toBe(true);
  });

  test("removing a block asks first, then removes it", async () => {
    const fetch = fakeApi({ blocks: sampleBlocks });
    renderAt(blocksPage);

    await userEvent.click(
      await screen.findByRole("button", { name: /^Remove, Saturday 14 November/ }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Remove block" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /^Remove, Saturday 14 November/ })).toBeNull(),
    );
    expect(
      fetch.mock.calls.some(
        ([url, init]) =>
          url === `${LORI}/blocks/block-1` &&
          (init as RequestInit | undefined)?.method === "DELETE",
      ),
    ).toBe(true);
  });
});
