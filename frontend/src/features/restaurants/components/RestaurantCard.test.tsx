// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test } from "vitest";

import { RestaurantCard } from "@/features/restaurants/components/RestaurantCard";
import type { RestaurantSummary } from "@/types/api";

afterEach(cleanup);

const lori: RestaurantSummary = {
  slug: "lori-smokehouse",
  name: "Lori Smokehouse",
  description: "Khorovats and slow-smoked meats, cooked over an open grill.",
  cuisines: ["ARMENIAN", "STEAKHOUSE"],
  district: "ARABKIR",
  address: "52 Komitas Avenue, Yerevan",
  priceLevel: 2,
  avgRating: 0,
  reviewCount: 0,
  coverPhotoUrl: null,
};

function renderCard(restaurant: RestaurantSummary = lori): HTMLElement {
  render(
    <MemoryRouter>
      <RestaurantCard restaurant={restaurant} />
    </MemoryRouter>,
  );
  return screen.getByRole("article");
}

test("the card is one link, named by the restaurant, to its page", () => {
  renderCard();

  const links = screen.getAllByRole("link");
  expect(links).toHaveLength(1);
  expect(links[0]?.getAttribute("href")).toBe("/restaurants/lori-smokehouse");
  expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Lori Smokehouse");
  expect(screen.getByRole("link", { name: "Lori Smokehouse" })).toBeDefined();
});

test("says what it serves, where and for how much, with the price in words for screen readers", () => {
  renderCard();

  expect(screen.getByText(/^Armenian · Steakhouse · Arabkir/)).toBeDefined();
  expect(screen.getByText("֏֏").getAttribute("aria-hidden")).toBe("true");
  expect(screen.getByText("Moderate").className).toContain("sr-only");
  expect(screen.getByText(lori.description ?? "")).toBeDefined();
});

test("with no photo, a menu cover shows the name, and screen readers skip it", () => {
  const card = renderCard();

  expect(card.querySelector("img")).toBeNull();
  const cover = card.querySelector('[aria-hidden="true"]');
  expect(cover?.textContent).toBe("Lori Smokehouse");
  expect(cover?.className).toMatch(/bg-tone-[1-6]/);
});

test("with a photo, it shows the photo at a sensible size, as decoration", () => {
  const card = renderCard({
    ...lori,
    coverPhotoUrl: "https://res.cloudinary.com/seghan/image/upload/v1/lori/grill.jpg",
  });

  const photo = card.querySelector("img");
  expect(photo?.getAttribute("src")).toBe(
    "https://res.cloudinary.com/seghan/image/upload/f_auto,q_auto,w_800/v1/lori/grill.jpg",
  );
  expect(photo?.getAttribute("alt")).toBe("");
  expect(photo?.getAttribute("loading")).toBe("lazy");
});

test("no description leaves no empty line, and the heading level can change", () => {
  render(
    <MemoryRouter>
      <RestaurantCard restaurant={{ ...lori, description: null }} heading="h3" />
    </MemoryRouter>,
  );

  expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Lori Smokehouse");
  // The description is the clamped paragraph, and there isn't one.
  expect(screen.getByRole("article").querySelector(".line-clamp-2")).toBeNull();
});
