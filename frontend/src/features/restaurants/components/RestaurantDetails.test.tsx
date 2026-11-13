// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, test } from "vitest";

import {
  dolmamaPage,
  kamanchaPage,
  loriPage,
  mayrigPage,
  reviewedPage,
  sampleReviews,
  sherepPage,
  tsiranPage,
  yasamanPage,
} from "@/features/design/samples";
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
  renderDetails({ restaurant: { ...tsiranPage, avgRating: 0, reviewCount: 0 } });
  expect(screen.getByText("No reviews yet. Guests can leave one after their visit.")).toBeDefined();
  cleanup();

  renderDetails({ restaurant: reviewedPage });
  expect(screen.getByText(/^Rated/).textContent).toBe("Rated 4.6 out of 5 by 23 guests.");
});

test("the reviews themselves follow the rating, under the Reviews heading", () => {
  renderDetails({
    restaurant: reviewedPage,
    reviews: {
      reviews: sampleReviews,
      failed: false,
      retrying: false,
      onRetry: () => {},
      hasMore: true,
      loadingMore: false,
      moreFailed: false,
      onMore: () => {},
    },
  });

  const section = screen.getByRole("heading", { name: "Reviews" }).closest("section")!;
  expect(section.querySelectorAll("li")).toHaveLength(sampleReviews.length);
  expect(section.textContent).toContain("Show more reviews");
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
        { url: photo("room"), isCover: true, credit: null, creditUrl: null },
        { url: photo("glass"), isCover: false, credit: null, creditUrl: null },
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

test("a cover a crop would spoil (covers.ts) is shown whole on the paper tint, any other fills its frame", () => {
  const bar =
    "https://res.cloudinary.com/seghan/image/upload/v1/seghan/demo-listings/node-12246284869/466cc90a3f0cb4a9";
  renderDetails({
    restaurant: {
      ...tsiranPage,
      coverPhotoUrl: bar,
      photos: [{ url: bar, isCover: true, credit: null, creditUrl: null }],
    },
  });

  const whole = screen.getByRole("article").querySelector("img");
  expect(whole?.className).toContain("object-contain");
  expect(whole?.className).toContain("bg-surface-tinted");
  expect(whole?.className).not.toContain("object-cover");
  cleanup();

  renderDetails({ restaurant: dolmamaPage });
  const cropped = screen.getByRole("article").querySelector("img");
  expect(cropped?.className).toContain("object-cover");
  expect(cropped?.className).not.toMatch(/object-contain|bg-surface-tinted/);
});

test("in /design, the headings step down, so the page keeps one h1", () => {
  renderDetails({ headingLevel: 4 });

  expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  expect(screen.getByRole("heading", { level: 4 }).textContent).toBe("Tsiran Wine Room");
  expect(screen.getAllByRole("heading", { level: 5 })).toHaveLength(4);
});

test("a restaurant that isn't a demo listing has no test-booking line and no details credit", () => {
  renderDetails({ booking: <p>The booking widget</p> });

  expect(screen.getByText("The booking widget")).toBeDefined();
  expect(screen.queryByText(/test booking/)).toBeNull();
  expect(screen.queryByText(/OpenStreetMap/)).toBeNull();
});

describe("a demo listing (9.7)", () => {
  test("one line before the booking says it's a test booking, one line under the cover credits its details, and it has its Reviews", () => {
    renderDetails({ restaurant: mayrigPage, booking: <p>The booking widget</p> });

    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Book a table",
      "Address",
      "Opening hours",
      "Contact",
      "Reviews",
    ]);
    const note = screen.getByText("This is a test booking. The restaurant won’t receive it.");
    expect(note.closest("section")?.querySelector("h2")?.textContent).toBe("Book a table");
    expect(note.compareDocumentPosition(screen.getByText("The booking widget"))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(
      screen.getByText("No reviews yet. Guests can leave one after their visit."),
    ).toBeDefined();
    // Credited as OpenStreetMap asks, and as Geoapify's free plan asks beside what its API
    // returned, in one line under the cover: here its name on its tone, as it has no photo.
    const copyright = screen.getByRole("link", { name: /OpenStreetMap contributors/ });
    expect(copyright.getAttribute("href")).toBe("https://www.openstreetmap.org/copyright");
    const credit = copyright.parentElement;
    expect(credit?.textContent).toMatch(
      /^Details © OpenStreetMap contributors.*, through Geoapify[^.]*$/,
    );
    expect(credit?.parentElement?.previousElementSibling?.className).toMatch(/bg-tone-[1-6]/);
    expect(screen.getByRole("link", { name: /Geoapify/ }).getAttribute("href")).toBe(
      "https://www.geoapify.com/",
    );
    // No badge or heading saying it's a demo, and no link to its place at OpenStreetMap.
    expect(screen.queryByText(/Demo listing|public listings|may have changed/)).toBeNull();
    expect(screen.queryByRole("link", { name: /See it on OpenStreetMap/ })).toBeNull();
    // No price: just its district above the name.
    expect(screen.getByRole("heading", { level: 1 }).previousElementSibling?.textContent).toBe(
      "Kentron",
    );
  });

  test("its photos are credited under the cover, each linking to its page at Commons, then its details", () => {
    renderDetails({ restaurant: dolmamaPage });

    const credits = screen.getByText(/^Photos:/);
    expect(credits.textContent).toBe(
      "Photos: Benoît Prieur, CC0, opens in a new tab · Benoît Prieur, CC0, opens in a new tab · Sebleouf, CC BY-SA 4.0, opens in a new tab, via Wikimedia Commons",
    );
    const links = [...credits.querySelectorAll("a")];
    expect(links.map((link) => link.getAttribute("href"))).toEqual(
      dolmamaPage.photos.map(({ creditUrl }) => creditUrl),
    );
    expect(links.every((link) => link.getAttribute("target") === "_blank")).toBe(true);
    expect(credits.nextElementSibling?.textContent).toMatch(
      /^Details © OpenStreetMap contributors/,
    );
  });
});

test("an owner's own photos need no credit, so none is shown", () => {
  renderDetails({
    restaurant: {
      ...tsiranPage,
      coverPhotoUrl: "https://res.cloudinary.com/x/room.jpg",
      photos: [
        {
          url: "https://res.cloudinary.com/x/room.jpg",
          isCover: true,
          credit: null,
          creditUrl: null,
        },
      ],
    },
  });

  expect(screen.queryByText(/via Wikimedia Commons/)).toBeNull();
});

test("a demo listing with details missing shows no cuisine line, says its hours aren't listed, and has no contact", () => {
  renderDetails({ restaurant: kamanchaPage });

  const title = screen.getByRole("heading", { level: 1 });
  // Its district above the name, and nothing under it where a cuisine would be.
  expect(title.previousElementSibling?.textContent).toBe("Kentron");
  expect(title.nextElementSibling).toBeNull();
  expect(screen.getByText("Opening hours aren’t listed yet.")).toBeDefined();
  expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
    "Address",
    "Opening hours",
    "Reviews",
  ]);
});

test("a restaurant's own photos are credited to its site once, Commons ones with their licenses, in order", () => {
  renderDetails({ restaurant: sherepPage });

  const credits = screen.getByText(/^Photos:/);
  expect(credits.textContent).toBe(
    "Photos: Yeremyan Projects’ website, opens in a new tab; Benoît Prieur, CC0, opens in a new tab, via Wikimedia Commons",
  );
  expect([...credits.querySelectorAll("a")].map((link) => link.getAttribute("href"))).toEqual([
    "https://www.yeremyanprojects.com/en/restaurants/sherep",
    sherepPage.photos[4]?.creditUrl,
  ]);
});

test("a demo listing not in OpenStreetMap has no details credit: only OpenStreetMap's license asks for one", () => {
  renderDetails({ restaurant: yasamanPage });

  expect(screen.queryByText(/OpenStreetMap|public listings/)).toBeNull();
  expect(screen.queryByRole("link", { name: /Geoapify/ })).toBeNull();
  expect(screen.getByText(/sturgeon kebab/)).toBeDefined();
});
