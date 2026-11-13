// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test } from "vitest";

import { sampleRestaurants } from "@/features/design/samples";
import { SavedRestaurants } from "@/features/favorites/components/SavedRestaurants";
import type { SavedPreviewState } from "@/features/favorites/components/SavedRestaurants";
import type { RestaurantSummary } from "@/types/api";

afterEach(cleanup);

function renderSaved(saved: SavedPreviewState): void {
  render(
    <MemoryRouter>
      <SavedRestaurants saved={saved} />
    </MemoryRouter>,
  );
}

const loaded = (data: RestaurantSummary[], total = data.length): SavedPreviewState => ({
  data: { data, meta: { page: 1, pageSize: 12, total } },
  failed: false,
});

const panel = (): HTMLElement => screen.getByRole("complementary", { name: "Saved restaurants" });

test("the panel is named by its heading, with how many are saved beside it", () => {
  renderSaved(loaded(sampleRestaurants.slice(0, 2)));

  expect(screen.getByRole("heading", { level: 2, name: "Saved restaurants" })).toBeDefined();
  expect(screen.getByText("2")).toBeDefined();
  expect(panel()).toBeDefined();
});

test("the first four are links to their pages, and See all leads to the rest", () => {
  // Six saved: the panel shows four.
  renderSaved(loaded(sampleRestaurants));

  const links = screen.getAllByRole("link");
  expect(links.slice(0, -1).map((link) => link.getAttribute("href"))).toEqual(
    sampleRestaurants.slice(0, 4).map(({ slug }) => `/restaurants/${slug}`),
  );
  expect(screen.getByRole("link", { name: "See all 6" }).getAttribute("href")).toBe("/favorites");
});

test("the total counts every saved one, not just those loaded", () => {
  renderSaved(loaded(sampleRestaurants.slice(0, 4), 23));

  expect(screen.getByText("23")).toBeDefined();
  expect(screen.getByRole("link", { name: "See all 23" }).getAttribute("href")).toBe("/favorites");
});

test("four or fewer need no See all", () => {
  renderSaved(loaded(sampleRestaurants.slice(0, 4)));

  expect(screen.getAllByRole("link")).toHaveLength(4);
  expect(screen.queryByRole("link", { name: /^See all/ })).toBeNull();
});

test("each shows its name, and what it serves and where", () => {
  // Lori Smokehouse: Armenian and steakhouse, in Arabkir.
  renderSaved(loaded(sampleRestaurants.slice(1, 2)));

  const link = screen.getByRole("link", {
    name: "Lori Smokehouse Armenian · Steakhouse · Arabkir",
  });
  expect(link.getAttribute("href")).toBe("/restaurants/lori-smokehouse");
  expect(screen.getByText("Armenian · Steakhouse · Arabkir")).toBeDefined();
});

test("with none saved, it says how to save one", () => {
  renderSaved(loaded([]));

  expect(panel().textContent).toContain("Save a restaurant from its page, and it shows here.");
  expect(screen.getByText("0")).toBeDefined();
  expect(screen.queryByRole("link")).toBeNull();
});

test("when they can't load, it says so", () => {
  renderSaved({ data: undefined, failed: true });

  expect(panel().textContent).toContain("We couldn’t load your saved restaurants.");
  expect(screen.queryByRole("link")).toBeNull();
});

test("while they load, it shows only its heading", () => {
  renderSaved({ data: undefined, failed: false });

  expect(panel().textContent).toBe("Saved restaurants");
  expect(screen.queryByRole("list")).toBeNull();
  expect(screen.queryByRole("link")).toBeNull();
});
