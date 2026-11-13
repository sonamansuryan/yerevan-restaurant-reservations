// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { AdminRestaurants } from "@/features/admin/components/AdminRestaurants";
import type { AdminRestaurantsProps } from "@/features/admin/components/AdminRestaurants";
import type { AdminListState } from "@/features/admin/components/AdminListBody";
import { adminRestaurants, dolmamaListed, hiddenTbilisi } from "@/features/design/samples";
import { ApiError } from "@/lib/api";
import type { AdminRestaurant } from "@/types/api";

// jsdom has no showModal(), which Modal uses. These open and close it the simple way.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
});

afterEach(cleanup);

const lori = adminRestaurants[1]!;

const loaded = (
  data: AdminRestaurant[],
  total = data.length,
  page = 1,
): AdminListState<AdminRestaurant> => ({
  data: { data, meta: { page, pageSize: 20, total } },
  failed: false,
  retrying: false,
  onRetry: vi.fn(),
  updating: false,
});

function renderPart(change: Partial<AdminRestaurantsProps> = {}): AdminRestaurantsProps {
  const props: AdminRestaurantsProps = {
    filters: { page: 1 },
    onFiltersChange: vi.fn(),
    list: loaded(adminRestaurants),
    hrefFor: (page) => `/admin?page=${page}`,
    today: "2026-11-12",
    changingId: null,
    changed: null,
    refusal: null,
    onHide: vi.fn(),
    onShow: vi.fn(),
    ...change,
  };
  render(
    <MemoryRouter>
      <AdminRestaurants {...props} />
    </MemoryRouter>,
  );
  return props;
}

const line = (name: string): HTMLElement =>
  screen.getByText(name, { selector: "p" }).closest("li") as HTMLElement;

describe("the lines", () => {
  test("each with its owner, its bookings and what guests see", () => {
    renderPart();

    expect(screen.getByRole("status").textContent).toBe("6 restaurants");
    expect(line("Lori Smokehouse").textContent).toContain(
      "Arabkir · Ani Sargsyan · ani.owner@example.com",
    );
    expect(line("Lori Smokehouse").textContent).toContain("48 bookings");
    expect(within(line("Lori Smokehouse")).getByText("Published")).toBeDefined();
    expect(within(line("Սարդարապատ ազգագրական ճաշարան")).getByText("Draft")).toBeDefined();
  });

  test("a demo listing (9.7) says so, and its owner is the account nobody signs in to", () => {
    renderPart({ list: loaded([dolmamaListed, ...adminRestaurants]) });

    expect(line("Dolmama").textContent).toContain("Seghan demo listings · listings@example.com");
    expect(line("Dolmama").textContent).toContain("0 bookings · Demo listing");
    expect(line("Lori Smokehouse").textContent).not.toContain("Demo listing");
  });

  test("a hidden one says so, and since when, and offers Show again instead of Hide", () => {
    renderPart();

    const tbilisi = within(line("Tbilisi Courtyard"));
    expect(tbilisi.getByText("Hidden by Seghan")).toBeDefined();
    expect(line("Tbilisi Courtyard").textContent).toContain(
      "6 bookings · Hidden on Tuesday 10 November",
    );
    expect(tbilisi.getByRole("button", { name: "Show Tbilisi Courtyard again" })).toBeDefined();
    expect(tbilisi.queryByRole("button", { name: /^Hide/ })).toBeNull();
    // Guests can't open its page, so there's no link to it.
    expect(tbilisi.queryByRole("link")).toBeNull();
  });

  test("only a restaurant guests can see links to its page", () => {
    renderPart();

    expect(
      within(line("Lori Smokehouse"))
        .getByRole("link", { name: "See the guests’ page of Lori Smokehouse" })
        .getAttribute("href"),
    ).toBe("/restaurants/lori-smokehouse");
    expect(within(line("Սարդարապատ ազգագրական ճաշարան")).queryByRole("link")).toBeNull();
  });
});

describe("hiding", () => {
  test("it asks first, and Don’t hide changes nothing", async () => {
    const props = renderPart();

    await userEvent.click(screen.getByRole("button", { name: "Hide Lori Smokehouse" }));

    const question = screen.getByRole("dialog", { name: "Hide this restaurant?" });
    expect(question.textContent).toContain(
      "Guests won’t find or book Lori Smokehouse until you show it again. Its bookings stay as they are, and its owner sees that Seghan hid it.",
    );
    await userEvent.click(within(question).getByRole("button", { name: "Don’t hide" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(props.onHide).not.toHaveBeenCalled();
  });

  test("Hide restaurant sends it", async () => {
    const props = renderPart();

    await userEvent.click(screen.getByRole("button", { name: "Hide Lori Smokehouse" }));
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Hide restaurant" }),
    );

    expect(props.onHide).toHaveBeenCalledWith(lori);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("showing one again happens at once, without asking", async () => {
    const props = renderPart();

    await userEvent.click(screen.getByRole("button", { name: "Show Tbilisi Courtyard again" }));

    expect(props.onShow).toHaveBeenCalledWith(hiddenTbilisi);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("the line's button waits while its change is sent", () => {
    renderPart({ changingId: lori.id });

    const button = screen.getByRole("button", { name: "Hide Lori Smokehouse" });
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(
      screen.getByRole("button", { name: "Hide Kond House" }).getAttribute("aria-busy"),
    ).toBeNull();
  });

  test("what happened is said, and focused, since the button may have gone", () => {
    renderPart({ changed: { ...lori, hiddenAt: "2026-11-12T08:00:00.000Z" } });

    const notice = screen.getAllByRole("status")[0]!;
    expect(notice.textContent).toBe(
      "Lori Smokehouse is hidden. Guests can’t find or book it until you show it again.",
    );
    expect(document.activeElement?.contains(notice)).toBe(true);
  });

  test("a refusal is said as the server put it", () => {
    renderPart({
      refusal: new ApiError(404, "RESTAURANT_NOT_FOUND", "We couldn’t find this restaurant."),
    });

    expect(screen.getByRole("alert").textContent).toBe("We couldn’t find this restaurant.");
  });
});

describe("the filters", () => {
  test("Show applies at once, back on page 1", async () => {
    const props = renderPart({ filters: { q: "lori", page: 3 } });

    await userEvent.selectOptions(screen.getByLabelText("Show"), "Hidden by Seghan");

    expect(props.onFiltersChange).toHaveBeenCalledWith({ q: "lori", show: "hidden", page: 1 });
  });

  test("the search applies when it's sent, trimmed, and an empty one clears it", async () => {
    const props = renderPart({ filters: { q: "lori", show: "draft", page: 2 } });
    const box = screen.getByRole("searchbox", { name: "Search" });

    await userEvent.clear(box);
    await userEvent.type(box, "  komitas {Enter}");
    await userEvent.clear(box);
    await userEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(vi.mocked(props.onFiltersChange).mock.calls).toEqual([
      [{ q: "komitas", show: "draft", page: 1 }],
      [{ q: undefined, show: "draft", page: 1 }],
    ]);
  });
});

describe("the list's states", () => {
  test("loading, then failed with Try again", async () => {
    renderPart({ list: { ...loaded([]), data: undefined } });
    expect(screen.getByRole("status", { name: "Loading the restaurants" })).toBeDefined();
    cleanup();

    const onRetry = vi.fn();
    renderPart({ list: { ...loaded([]), data: undefined, failed: true, onRetry } });
    expect(screen.getByText("We couldn’t load the restaurants.")).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalled();
  });

  test("nothing yet, nothing matching with Clear filters, and a page past the end", async () => {
    renderPart({ list: loaded([]) });
    expect(screen.getByText("No restaurants yet")).toBeDefined();
    cleanup();

    const filtered = renderPart({ filters: { show: "hidden", page: 1 }, list: loaded([]) });
    expect(screen.getByText("No restaurants match")).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(filtered.onFiltersChange).toHaveBeenCalledWith({ page: 1 });
    cleanup();

    const late = renderPart({ filters: { q: "a", page: 4 }, list: loaded([], 25, 4) });
    expect(screen.getByText("There are 25 restaurants on earlier pages.")).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Go to the first page" }));
    expect(late.onFiltersChange).toHaveBeenCalledWith({ q: "a", page: 1 });
  });

  test("more than a page links to the next", () => {
    renderPart({ list: loaded(adminRestaurants, 26) });

    expect(screen.getByRole("link", { name: "Next" }).getAttribute("href")).toBe("/admin?page=2");
  });
});
