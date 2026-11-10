// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test } from "vitest";

import { loriPage, reviewedPage, tsiranPage } from "@/features/design/samples";
import { RestaurantDetails } from "@/features/restaurants/components/RestaurantDetails";

afterEach(cleanup);

function renderDetails(props: Partial<ComponentProps<typeof RestaurantDetails>> = {}): HTMLElement {
  render(
    <MemoryRouter>
      <RestaurantDetails restaurant={tsiranPage} {...props} />
    </MemoryRouter>,
  );
  return screen.getByRole("article");
}

test("with no photo, the cover is the title: the name on the restaurant's tone", () => {
  renderDetails();

  const title = screen.getByRole("heading", { level: 1 });
  expect(title.textContent).toBe("Tsiran Wine Room");
  expect(title.parentElement?.className).toMatch(/bg-tone-[1-6]/);
  expect(screen.getByText("Armenian · European")).toBeDefined();
  // The price shows as dram signs, and reads as a word.
  expect(screen.getByText("֏֏").getAttribute("aria-hidden")).toBe("true");
  expect(screen.getByText("Moderate").className).toContain("sr-only");
});

test("the sections follow the title: address, opening hours, contact and reviews", () => {
  renderDetails();

  expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
    "Address",
    "Opening hours",
    "Contact",
    "Reviews",
  ]);
  expect(screen.getByText("31 Saryan Street, Yerevan").tagName).toBe("ADDRESS");
});

test("Open in Google Maps opens a new tab, safely, and says so", () => {
  renderDetails();

  const maps = screen.getByRole("link", { name: "Open in Google Maps, opens in a new tab" });
  expect(maps.getAttribute("href")).toBe(tsiranPage.mapsUrl);
  expect(maps.getAttribute("target")).toBe("_blank");
  expect(maps.getAttribute("rel")).toBe("noopener noreferrer");
});

test("the phone number calls, and a website shows its plain name", () => {
  renderDetails({
    restaurant: { ...tsiranPage, website: "https://www.tsiran.example/menu" },
  });

  expect(screen.getByRole("link", { name: "+37400000102" }).getAttribute("href")).toBe(
    "tel:+37400000102",
  );
  const website = screen.getByRole("link", { name: "tsiran.example, opens in a new tab" });
  expect(website.getAttribute("href")).toBe("https://www.tsiran.example/menu");
});

test("with no phone or website, there's no Contact section", () => {
  renderDetails({ restaurant: { ...tsiranPage, phone: null } });

  expect(screen.queryByRole("heading", { name: "Contact" })).toBeNull();
});

test("reviews say there are none yet, or give the rating and how many guests", () => {
  renderDetails();
  expect(screen.getByText("No reviews yet. Guests can leave one after their visit.")).toBeDefined();
  cleanup();

  renderDetails({ restaurant: reviewedPage });
  expect(screen.getByText(/^Rated/).textContent).toBe("Rated 4.6 out of 5 by 23 guests.");
});

test("no description leaves no empty paragraph", () => {
  const page = renderDetails({ restaurant: loriPage });

  expect(page.querySelector("p.text-lead.text-pretty")).toBeNull();
});

test("with photos, the cover photo leads at two sizes, and the others follow", () => {
  const photo = (name: string): string =>
    `https://res.cloudinary.com/seghan/image/upload/v1/tsiran/${name}.jpg`;
  const page = renderDetails({
    restaurant: {
      ...tsiranPage,
      coverPhotoUrl: photo("room"),
      photos: [
        { url: photo("room"), isCover: true },
        { url: photo("glass"), isCover: false },
      ],
    },
  });

  const [cover, ...others] = [...page.querySelectorAll("img")];
  expect(cover?.getAttribute("srcset")).toBe(
    `${photo("room").replace("upload/", "upload/f_auto,q_auto,w_800/")} 800w, ${photo("room").replace("upload/", "upload/f_auto,q_auto,w_1600/")} 1600w`,
  );
  expect(others.map((img) => img.getAttribute("src"))).toEqual([
    photo("glass").replace("upload/", "upload/f_auto,q_auto,w_600/"),
  ]);
  // With a photo, the title sits below it in ink, not on a tone.
  expect(screen.getByRole("heading", { level: 1 }).parentElement?.className).not.toMatch(/tone/);
});

test("in /design, the headings step down, so the page keeps one h1", () => {
  renderDetails({ headingLevel: 4 });

  expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  expect(screen.getByRole("heading", { level: 4 }).textContent).toBe("Tsiran Wine Room");
  expect(screen.getAllByRole("heading", { level: 5 })).toHaveLength(4);
});
