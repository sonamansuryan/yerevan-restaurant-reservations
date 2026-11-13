// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test, vi } from "vitest";

import { sampleRestaurants } from "@/features/design/samples";
import { FeaturedRestaurants } from "@/features/restaurants/components/FeaturedRestaurants";

afterEach(cleanup);

function renderFeatured(props: Partial<ComponentProps<typeof FeaturedRestaurants>> = {}): void {
  render(
    <MemoryRouter>
      <FeaturedRestaurants onRetry={vi.fn()} {...props} />
    </MemoryRouter>,
  );
}

const three = { data: sampleRestaurants.slice(0, 3), meta: { page: 1, pageSize: 3, total: 6 } };

test("shows the restaurants as cards, each named under the section's heading", () => {
  renderFeatured({ results: three });

  expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
    "Kond House",
    "Lori Smokehouse",
    "Nurr",
  ]);
  expect(screen.getByRole("link", { name: "Nurr" }).getAttribute("href")).toBe("/restaurants/nurr");
});

test("each card carries the times the page gives it for that restaurant", () => {
  renderFeatured({
    results: three,
    timesFor: (restaurant) => <p>{`Tonight at ${restaurant.name}`}</p>,
  });

  const cards = screen.getAllByRole("article");
  expect(cards.map((card) => card.textContent?.includes(`Tonight at`))).toEqual([true, true, true]);
  expect(screen.getByText("Tonight at Nurr").closest("article")).toBe(cards[2]);
});

test("while loading, the breathing dot shows", () => {
  renderFeatured();

  expect(screen.getByRole("status", { name: "Loading restaurants" })).toBeDefined();
});

test("with nothing published yet, it says so", () => {
  renderFeatured({ results: { data: [], meta: { page: 1, pageSize: 3, total: 0 } } });

  expect(screen.getByText("No restaurants yet")).toBeDefined();
  expect(screen.queryByRole("article")).toBeNull();
});

test("a failure offers Try again", async () => {
  const onRetry = vi.fn();
  renderFeatured({ failed: true, onRetry });

  expect(screen.getByText("We couldn’t load the restaurants.")).toBeDefined();
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));

  expect(onRetry).toHaveBeenCalledOnce();
});
