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
  isDemoListing: false,
};

function renderCard(restaurant: RestaurantSummary = lori): HTMLElement {
  render(
    <MemoryRouter>
      <RestaurantCard restaurant={restaurant} />
    </MemoryRouter>,
  );
  return screen.getByRole("article");
}

test("once guests have reviewed it, a line says how they rate it", () => {
  const card = renderCard({ ...lori, avgRating: 4.36, reviewCount: 18 });

  expect(card.textContent).toContain("Rated 4.4 by 18 guests");
  // The star is drawn, and screen readers skip it: "Rated" says what the number is.
  expect(card.textContent).not.toContain("★");
  expect(screen.getByText("4.4").querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  cleanup();

  expect(renderCard({ ...lori, avgRating: 5, reviewCount: 1 }).textContent).toContain(
    "Rated 5.0 by 1 guest",
  );
  cleanup();

  expect(renderCard().textContent).not.toContain("Rated");
});

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

test("the home page's cards can leave out the description, to keep tonight's times close", () => {
  render(
    <MemoryRouter>
      <RestaurantCard restaurant={lori} description={false} />
    </MemoryRouter>,
  );

  expect(screen.queryByText(lori.description ?? "")).toBeNull();
  expect(screen.getByText(/^Armenian · Steakhouse · Arabkir/)).toBeDefined();
});

test("its footer sits above the card's link, so what's in it can be pressed", () => {
  render(
    <MemoryRouter>
      <RestaurantCard
        restaurant={lori}
        footer={<a href="/restaurants/lori-smokehouse?time=19%3A00">19:00</a>}
      />
    </MemoryRouter>,
  );

  const wrapper = screen.getByRole("link", { name: "19:00" }).parentElement;
  expect(wrapper?.className).toContain("relative");
  expect(wrapper?.className).toContain("z-10");
});

test("saving it sits on the photo, above the card's link, so it can be pressed", () => {
  render(
    <MemoryRouter>
      <RestaurantCard
        restaurant={lori}
        save={<button type="button">Save Lori Smokehouse</button>}
      />
    </MemoryRouter>,
  );

  const save = screen.getByRole("button", { name: "Save Lori Smokehouse" });
  expect(save.parentElement?.className).toContain("z-10");
  // On the photo, before the name.
  expect(save.compareDocumentPosition(screen.getByRole("heading"))).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );
});

test("a cover a crop would spoil (covers.ts) is shown whole on the paper tint, any other fills the card", () => {
  const listings = "https://res.cloudinary.com/seghan/image/upload/v1/seghan/demo-listings";
  const whole = renderCard({
    ...lori,
    coverPhotoUrl: `${listings}/node-12246284869/466cc90a3f0cb4a9`,
  }).querySelector("img");

  expect(whole?.className).toContain("object-contain");
  expect(whole?.className).not.toContain("object-cover");
  expect(whole?.parentElement?.className).toContain("bg-surface-tinted");
  cleanup();

  // PAUL's cover is square too, and still fills its card.
  const cropped = renderCard({
    ...lori,
    coverPhotoUrl: `${listings}/node-11197827655/c8cbe22ed2549e9e`,
  }).querySelector("img");
  expect(cropped?.className).toContain("object-cover");
  expect(cropped?.className).not.toContain("object-contain");
  expect(cropped?.parentElement?.className).not.toContain("bg-surface-tinted");
});

test("a demo listing (9.7) has no price, which no source gives, and no badge saying it's a demo", () => {
  const card = renderCard({ ...lori, priceLevel: null, isDemoListing: true });

  expect(screen.getByText(/^Armenian · Steakhouse · Arabkir/).textContent).toBe(
    "Armenian · Steakhouse · Arabkir",
  );
  expect(card.textContent).not.toContain("֏");
  expect(card.textContent).not.toMatch(/demo/i);
});
