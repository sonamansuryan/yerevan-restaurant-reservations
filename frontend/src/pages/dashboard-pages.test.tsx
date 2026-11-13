// @vitest-environment jsdom
// The owner's dashboard through the real routes, shell, guard and hooks, with a fake API.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Mock } from "vitest";

import { DAY_REFRESH_MS } from "@/features/dashboard/hooks/useDayReservations";
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
  /** What a change to a booking answers, if not a success. */
  bookingChange?: Response;
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
  bookingChange,
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
    if (url.startsWith(`${LORI}/reservations/`) && method === "PATCH") {
      if (bookingChange) return Promise.resolve(bookingChange);
      const booking = fridayBookings.find(({ id }) => url.endsWith(`/${id}`));
      return Promise.resolve(
        json({ reservation: { ...booking, ...(body as object), actions: [] } }),
      );
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

/** One of the day's four figures: the number under its label. */
const figure = (label: string): string | null | undefined =>
  screen.getByText(label, { selector: "dt" }).nextElementSibling?.textContent;

describe("your restaurants", () => {
  test("each of the owner's restaurants opens its own dashboard", async () => {
    fakeApi();
    renderAt("/dashboard");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Your restaurants" }),
    ).toBeDefined();
    const lori = await screen.findByRole("link", { name: /Lori Smokehouse/ });
    expect(lori.getAttribute("href")).toBe(`/dashboard/${ownedLori.id}`);
    // The page's own button beside its heading, and the menu's link.
    const adds = screen.getAllByRole("link", { name: "Add a restaurant" });
    expect(adds.map((link) => link.getAttribute("href"))).toEqual([
      "/dashboard/new",
      "/dashboard/new",
    ]);
  });

  test("the owner's menu leads to their restaurants and to adding one, with Sign out", async () => {
    fakeApi();
    renderAt("/dashboard");

    const menu = within(await screen.findByRole("navigation", { name: "Owner dashboard" }));
    expect(
      menu.getAllByRole("link").map((link) => `${link.textContent} ${link.getAttribute("href")}`),
    ).toEqual(["Your restaurants /dashboard", "Add a restaurant /dashboard/new"]);
    expect(menu.getByRole("link", { name: "Your restaurants" }).getAttribute("aria-current")).toBe(
      "page",
    );
    // The page's heading is beside the menu, so the menu's name isn't one.
    expect(screen.queryByRole("heading", { name: "Owner dashboard" })).toBeNull();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeDefined();
    // The back room has its own menu, in place of the site's header and footer.
    expect(screen.queryByRole("banner")).toBeNull();
    expect(screen.queryByRole("contentinfo")).toBeNull();
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

describe("moving a booking on, in the day's bookings", () => {
  const dayRequests = (fetch: Mock): string[] =>
    requests(fetch).filter((url) => url.startsWith(`${LORI}/reservations?`));

  test("Confirm sends the change, says so, and asks for the day again", async () => {
    const fetch = fakeApi();
    renderAt(`/dashboard/${ownedLori.id}`);

    await userEvent.click(
      await screen.findByRole("button", { name: "Confirm, Aram Khachatryan, 19:30" }),
    );

    expect(
      await screen.findByText("Aram Khachatryan’s booking at 19:30 is confirmed."),
    ).toBeDefined();
    expect(sent(fetch, "PATCH", `${LORI}/reservations/booking-4`)).toEqual({ status: "CONFIRMED" });
    await waitFor(() => expect(dayRequests(fetch)).toHaveLength(2));
  });

  test("a change refused by the server is said in its words, and the day is asked for again", async () => {
    const fetch = fakeApi({
      bookingChange: refusal(409, "ALREADY_CANCELLED", "This booking is already cancelled."),
    });
    renderAt(`/dashboard/${ownedLori.id}`);

    await userEvent.click(
      await screen.findByRole("button", { name: "Confirm, Aram Khachatryan, 19:30" }),
    );

    expect((await screen.findByRole("alert")).textContent).toBe(
      "This booking is already cancelled.",
    );
    await waitFor(() => expect(dayRequests(fetch)).toHaveLength(2));
  });

  test("an open day is asked for again every 30 seconds, so new bookings show up", async () => {
    // Intervals are faked too here, so 30 seconds can pass at once.
    vi.useFakeTimers({
      toFake: ["Date", "setInterval", "clearInterval"],
      now: new Date("2026-11-13T10:00:00Z"),
    });
    const fetch = fakeApi();
    renderAt(`/dashboard/${ownedLori.id}`);
    await screen.findByText("Anahit Petrosyan");
    const asked = dayRequests(fetch).length;

    await act(async () => {
      vi.advanceTimersByTime(DAY_REFRESH_MS);
    });

    await vi.waitFor(() => expect(dayRequests(fetch)).toHaveLength(asked + 1));
  });
});

describe("a restaurant's dashboard", () => {
  test("it opens on today's reservations, by Yerevan's calendar, with the day's hours", async () => {
    const fetch = fakeApi();
    renderAt(`/dashboard/${ownedLori.id}`);

    expect(await screen.findByRole("heading", { level: 1, name: "Lori Smokehouse" })).toBeDefined();
    expect(await screen.findByText("Anahit Petrosyan")).toBeDefined();
    expect(requests(fetch)).toContain(`${LORI}/reservations?date=2026-11-13&page=1`);
    // The part's heading, with the day under it, and the day's hours once they've come.
    expect(screen.getByRole("heading", { level: 2, name: "Reservations" })).toBeDefined();
    expect(await screen.findByText("Friday 13 November · Open 18:00 – 02:00")).toBeDefined();
    expect(requests(fetch)).toContain(`${LORI}/opening-hours`);
    expect(screen.getByRole("link", { name: "Today" }).getAttribute("aria-current")).toBe("page");
    // The menu counts today's bookings still to confirm: Aram's.
    expect(
      screen.getByRole("link", { name: "Reservations, 1 to confirm" }).getAttribute("aria-current"),
    ).toBe("page");
    // The day at a glance: guests expected leave out the cancellation and the no-show.
    expect(figure("Guests expected")).toBe("14");
    expect(figure("To confirm")).toBe("1");
    expect(figure("Seated")).toBe("1");
    expect(figure("No-shows")).toBe("1");
    await waitFor(() => expect(document.title).toBe("Reservations · Lori Smokehouse · Seghan"));
  });

  test("its menu leads back to all the restaurants, then to each part, and has Sign out", async () => {
    fakeApi();
    renderAt(`/dashboard/${ownedLori.id}`);

    const parts = within(await screen.findByRole("navigation", { name: "Lori Smokehouse" }));
    const base = `/dashboard/${ownedLori.id}`;
    expect(parts.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      base,
      `${base}/tables`,
      `${base}/hours`,
      `${base}/blocks`,
      `${base}/information`,
      `${base}/photos`,
      `${base}/analytics`,
    ]);
    expect(screen.getByRole("link", { name: "Your restaurants" }).getAttribute("href")).toBe(
      "/dashboard",
    );
    expect(screen.getByText("Owner dashboard")).toBeDefined();
    // Guests can see Lori, so its own page is a link away.
    expect(screen.getByRole("link", { name: "See the guests’ page" }).getAttribute("href")).toBe(
      `/restaurants/${ownedLori.slug}`,
    );
    expect(screen.getByRole("button", { name: "Sign out" })).toBeDefined();
    expect(screen.queryByRole("banner")).toBeNull();
    expect(screen.queryByRole("contentinfo")).toBeNull();
  });

  test("a restaurant guests can't see yet has no link to its guests' page", async () => {
    fakeApi({ lori: { ...ownedLori, isPublished: false } });
    renderAt(`/dashboard/${ownedLori.id}`);

    await screen.findByRole("navigation", { name: "Lori Smokehouse" });

    expect(screen.queryByRole("link", { name: "See the guests’ page" })).toBeNull();
  });

  test("the day is in the address, so Next day moves the book on, and Back returns", async () => {
    const fetch = fakeApi();
    const router = renderAt(`/dashboard/${ownedLori.id}?date=2026-11-13`);

    await userEvent.click(await screen.findByRole("link", { name: "Next day" }));

    expect(router.state.location.search).toBe("?date=2026-11-14");
    expect(await screen.findByText("Saturday 14 November · Open 18:00 – 02:00")).toBeDefined();
    expect(screen.getByRole("link", { name: "Today" }).getAttribute("aria-current")).toBeNull();
    await waitFor(() =>
      expect(requests(fetch)).toContain(`${LORI}/reservations?date=2026-11-14&page=1`),
    );

    await router.navigate(-1);

    expect(await screen.findByText("Friday 13 November · Open 18:00 – 02:00")).toBeDefined();
  });

  test("Go to opens the date chosen, once Show is pressed", async () => {
    const fetch = fakeApi();
    const router = renderAt(`/dashboard/${ownedLori.id}`);

    // A date input changes with each digit typed, so nothing opens until Show.
    fireEvent.change(await screen.findByLabelText("Go to"), { target: { value: "2026-12-31" } });
    expect(router.state.location.search).toBe("");
    await userEvent.click(screen.getByRole("button", { name: "Show" }));

    expect(router.state.location.search).toBe("?date=2026-12-31");
    expect(await screen.findByText("Thursday 31 December · Open 18:00 – 23:00")).toBeDefined();
    await waitFor(() =>
      expect(requests(fetch)).toContain(`${LORI}/reservations?date=2026-12-31&page=1`),
    );
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
    // The page's own way back, and the owner's menu around it.
    const ways = screen.getAllByRole("link", { name: "Your restaurants" });
    expect(ways.map((link) => link.getAttribute("href"))).toEqual(["/dashboard", "/dashboard"]);
    expect(screen.getByRole("navigation", { name: "Owner dashboard" })).toBeDefined();
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
    expect(screen.getByRole("heading", { level: 2, name: "Restaurant info" })).toBeDefined();
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
    const closes = within(friday).getByRole<HTMLSelectElement>("combobox", {
      name: "Friday closes",
    });
    // Found by its label's words. jsdom names it "Openon Friday", dropping the space before the
    // hidden words, which a browser keeps.
    const open = within(friday).getByLabelText<HTMLInputElement>("Open on Friday");
    expect(closes.selectedOptions[0]?.textContent).toBe("02:00 (next day)");
    expect(open.checked).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "Remove, Friday 18:00 to 02:00" }));
    // Save changes sits in the part's header, outside the form it sends.
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Opening hours saved.")).toBeDefined();
    const { hours } = sent(fetch, "PUT", `${LORI}/opening-hours`) as { hours: Opening[] };
    expect(hours).toHaveLength(tsiranPage.openingHours.length - 1);
    expect(hours).toContainEqual({ dayOfWeek: 6, opensAt: 1080, closesAt: 1560 });
    expect(within(friday).getByText("No bookings this day")).toBeDefined();
    expect(open.checked).toBe(false);
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

  test("Tables shows the floor plan as it stands now, beside every table", async () => {
    const fetch = fakeApi();
    renderAt(tablesPage);

    expect(
      await screen.findByText("7 tables, 37 seats · 1 inactive · As they stand at 14:00"),
    ).toBeDefined();
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(["Floor plan", "All tables"]);
    expect(screen.getByRole("link", { name: "Tables" }).getAttribute("aria-current")).toBe("page");
    await waitFor(() => expect(document.title).toBe("Tables · Lori Smokehouse · Seghan"));
    // How each table stands comes from today's bookings and the blocked times.
    expect(requests(fetch)).toContain(`${LORI}/reservations?date=2026-11-13&page=1`);
    expect(requests(fetch)).toContain(`${LORI}/blocks`);
    const plan = screen
      .getByRole("heading", { name: "Floor plan" })
      .closest("section") as HTMLElement;
    // Lilit has been at T1 since 12:30, Anahit has T3 at 19:00, and T6 is switched off.
    const words = (label: string): string | null | undefined =>
      within(plan).getByText(label).parentElement?.querySelector(".sr-only")?.textContent;
    expect(await within(plan).findByText(", 4 seats, seated until 14:30")).toBeDefined();
    expect(words("T1")).toBe(", 4 seats, seated until 14:30");
    expect(words("T3")).toBe(", 4 seats, reserved at 19:00");
    expect(words("T6")).toBe(", 4 seats, switched off");
    expect(words("T2")).toBe(", 2 seats, free now");
  });

  test("each table's line has a switch named after it, and a way to change it", async () => {
    fakeApi();
    renderAt(tablesPage);

    const t6 = await screen.findByRole<HTMLInputElement>("checkbox", { name: "Active, T6" });
    expect(t6.checked).toBe(false);
    expect(screen.getByRole<HTMLInputElement>("checkbox", { name: "Active, T1" }).checked).toBe(
      true,
    );

    await userEvent.click(screen.getByRole("button", { name: "Edit T1" }));

    expect(screen.getByRole("dialog", { name: "Edit T1" })).toBeDefined();
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

    await userEvent.click(await screen.findByRole("checkbox", { name: "Active, T1" }));

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

  test("the blocks are listed beside a month's calendar, starting on this month", async () => {
    fakeApi({ blocks: sampleBlocks });
    renderAt(blocksPage);

    expect(
      await screen.findByRole("heading", { level: 3, name: "Blocked dates & tables" }),
    ).toBeDefined();
    expect(screen.getByRole("heading", { level: 3, name: "November 2026" })).toBeDefined();
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
