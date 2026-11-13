// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, test, vi } from "vitest";

import { sampleRestaurants } from "@/features/design/samples";
import { favoritesPath } from "@/features/favorites/favorites";
import { MyFavorites } from "@/features/favorites/components/MyFavorites";
import type {
  FavoriteListState,
  MyFavoritesProps,
} from "@/features/favorites/components/MyFavorites";
import { ApiError } from "@/lib/api";
import type { RestaurantSummary } from "@/types/api";

afterEach(cleanup);

const favorites = [sampleRestaurants[2]!, sampleRestaurants[1]!];
const [nurr, lori] = favorites as [RestaurantSummary, RestaurantSummary];

const loaded = (data: RestaurantSummary[], total = data.length): FavoriteListState => ({
  data: { data, meta: { page: 1, pageSize: 12, total } },
  failed: false,
  retrying: false,
  onRetry: vi.fn(),
});

function renderFavorites(change: Partial<MyFavoritesProps> = {}): MyFavoritesProps {
  const props: MyFavoritesProps = {
    page: 1,
    list: loaded(favorites),
    hrefFor: favoritesPath,
    changingSlug: null,
    changed: null,
    refusal: null,
    onRemove: vi.fn(),
    onUndo: vi.fn(),
    onFindARestaurant: vi.fn(),
    onFirstPage: vi.fn(),
    ...change,
  };
  render(
    <MemoryRouter>
      <MyFavorites {...props} />
    </MemoryRouter>,
  );
  return props;
}

test("each saved restaurant is a card, as on Browse, with its Saved toggle, named in full", () => {
  renderFavorites();

  const cards = screen.getAllByRole("article");
  expect(cards.map((card) => within(card).getByRole("heading").textContent)).toEqual([
    "Nurr",
    "Lori Smokehouse",
  ]);
  expect(within(cards[0]!).getByRole("link", { name: "Nurr" }).getAttribute("href")).toBe(
    "/restaurants/nurr",
  );
  const toggle = within(cards[0]!).getByRole("button", { name: "Saved Nurr" });
  expect(toggle.getAttribute("aria-pressed")).toBe("true");
});

describe("taking one out", () => {
  test("pressing Saved asks to take that restaurant out", async () => {
    const { onRemove } = renderFavorites();

    await userEvent.click(screen.getByRole("button", { name: "Saved Lori Smokehouse" }));

    expect(onRemove).toHaveBeenCalledWith(lori);
  });

  test("while it's sent, that toggle waits", () => {
    renderFavorites({ changingSlug: nurr.slug });

    expect(screen.getByRole("button", { name: "Saved Nurr" }).getAttribute("aria-busy")).toBe(
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Saved Lori Smokehouse" }).getAttribute("aria-busy"),
    ).toBeNull();
  });

  test("once it's out, the notice says so and offers Undo, and focus moves there", async () => {
    const { onUndo } = renderFavorites({
      list: loaded([lori]),
      changed: { restaurant: nurr, saved: false },
    });

    const notice = screen.getByRole("status");
    expect(notice.textContent).toBe("Removed Nurr from your favorites. Undo");
    expect(document.activeElement?.contains(notice)).toBe(true);
    await userEvent.click(within(notice).getByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalledWith(nurr);
  });

  test("Undo waits while it's sent, then the notice says it's back", () => {
    renderFavorites({ changed: { restaurant: nurr, saved: false }, changingSlug: nurr.slug });
    expect(screen.getByRole("button", { name: "Undo" }).getAttribute("aria-busy")).toBe("true");
    cleanup();

    renderFavorites({ changed: { restaurant: nurr, saved: true } });
    expect(screen.getByRole("status").textContent).toBe("Nurr is back in your favorites.");
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });

  test("a refusal is said in the server's words", () => {
    renderFavorites({
      refusal: new ApiError(
        0,
        "NETWORK_ERROR",
        "We can't reach the server right now. Please try again.",
      ),
    });

    expect(screen.getByRole("alert").textContent).toBe(
      "We can't reach the server right now. Please try again.",
    );
  });
});

describe("nothing to list", () => {
  test("no favorites yet: one clear next step, finding a restaurant", async () => {
    const { onFindARestaurant } = renderFavorites({ list: loaded([]) });

    expect(screen.getByText("No favorites yet")).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Find a restaurant" }));
    expect(onFindARestaurant).toHaveBeenCalled();
  });

  test("past the last page: how many are on earlier pages, and the way back", async () => {
    const { onFirstPage } = renderFavorites({ page: 3, list: loaded([], 14) });

    expect(screen.getByText("There are 14 restaurants on earlier pages.")).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Go to the first page" }));
    expect(onFirstPage).toHaveBeenCalled();
  });
});

test("while the list loads, and when it can't", async () => {
  renderFavorites({ list: { data: undefined, failed: false, retrying: false, onRetry: vi.fn() } });
  expect(screen.getByRole("status", { name: "Loading your favorites" })).toBeDefined();
  cleanup();

  const onRetry = vi.fn();
  renderFavorites({ list: { data: undefined, failed: true, retrying: false, onRetry } });
  expect(screen.getByText("We couldn’t load your favorites.")).toBeDefined();
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(onRetry).toHaveBeenCalled();
});

test("more than a page: the next one is a link", () => {
  renderFavorites({ list: loaded(favorites, 14) });

  expect(screen.getByText("Page 1 of 2")).toBeDefined();
  expect(screen.getByRole("link", { name: "Next" }).getAttribute("href")).toBe("/favorites?page=2");
});
