// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
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

/** The line under the name, which says what the restaurant is. */
const aboutLine = (): HTMLElement => {
  const line = screen.getByRole("heading", { level: 1 }).parentElement?.nextElementSibling;
  if (!(line instanceof HTMLElement)) throw new Error("No line under the name");
  return line;
};
/** Its parts in order, each as all its text, the words for screen readers included. */
const aboutParts = (): (string | null)[] =>
  [...aboutLine().children].map((part) => part.textContent);

const photo = (name: string): string =>
  `https://res.cloudinary.com/seghan/image/upload/v1/tsiran/${name}.jpg`;
const at = (url: string, width: number): string =>
  url.replace("upload/", `upload/f_auto,q_auto,w_${width}/`);

test("with no photo, a menu cover stands in, and the name follows it with what it is", () => {
  const page = renderDetails();

  const cover = page.querySelector('[aria-hidden="true"][class*="bg-tone-"]');
  expect(cover?.textContent).toBe("Tsiran Wine Room");
  const title = screen.getByRole("heading", { level: 1 });
  expect(title.textContent).toBe("Tsiran Wine Room");
  expect(title.closest('[class*="bg-tone-"]')).toBeNull();
  // Its rating, cuisines, price and address, in one line under the name.
  expect(aboutParts()).toEqual([
    "Rated 4.0 by 1 guest(1 review)",
    "Armenian · European",
    "֏֏Moderate",
    "31 Saryan Street, Yerevan",
  ]);
  // The price shows as dram signs, and reads as a word.
  expect(screen.getByText("֏֏").getAttribute("aria-hidden")).toBe("true");
  expect(screen.getByText("Moderate").className).toContain("sr-only");
});

test("the rating is a drawn star and the average, read as a sentence, with the reviews counted for the eye", () => {
  renderDetails();

  const rating = within(aboutLine()).getByText("4.0");
  expect(rating.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  expect(rating.textContent).not.toContain("★");
  // Screen readers hear "Rated 4.0 by 1 guest".
  expect(within(rating).getByText("Rated").className).toContain("sr-only");
  expect(within(rating).getByText("by 1 guest").className).toContain("sr-only");
  expect(within(rating).getByText("(1 review)").getAttribute("aria-hidden")).toBe("true");
});

// Tsiran opens at 18:00, until 23:00 in the week and 02:00 at the weekend, and not on Monday.
test.each([
  ["on a Friday evening", 5, "19:30", "Open now · until 02:00"],
  ["after midnight, on Friday's late night", 6, "01:00", "Open now · until 02:00"],
  ["before it opens", 2, "12:00", "Opens at 18:00"],
  ["on its day off", 1, "12:00", "Closed now"],
])("given the day and time, the line says whether it's open: %s", (_, today, now, words) => {
  renderDetails({ today, now });

  expect(aboutParts().at(-1)).toBe(words);
});

test("without the time, it doesn't say whether it's open: the address ends the line", () => {
  renderDetails({ today: 5 });

  expect(aboutParts().at(-1)).toBe("31 Saryan Street, Yerevan");
});

test("a breadcrumb leads back to all restaurants, and to the restaurant's district", () => {
  renderDetails();

  const crumbs = within(screen.getByRole("navigation", { name: "Breadcrumb" }));
  expect(crumbs.getByRole("link", { name: "Restaurants" }).getAttribute("href")).toBe(
    "/restaurants",
  );
  expect(crumbs.getByRole("link", { name: "Kentron" }).getAttribute("href")).toBe(
    "/restaurants?district=KENTRON",
  );
  expect(crumbs.getByText("Tsiran Wine Room").getAttribute("aria-current")).toBe("page");
});

test("on a phone, where the breadcrumb is hidden, a way back to all restaurants sits on the photo", () => {
  renderDetails();

  expect(screen.getByRole("link", { name: "All restaurants" }).getAttribute("href")).toBe(
    "/restaurants",
  );
});

test("the sections follow the title: about, opening hours, contact, location and reviews", () => {
  renderDetails();

  expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
    "About",
    "Opening hours",
    "Contact",
    "Location",
    "Reviews",
  ]);
  // With no map, the address stands under Location, as well as in the line under the name.
  const location = screen.getByRole("heading", { name: "Location" }).closest("section")!;
  expect(within(location).getByText("31 Saryan Street, Yerevan").tagName).toBe("ADDRESS");
});

test("with a map, the address isn't said again under it: the line under the name has it", () => {
  renderDetails({ map: <p>The map</p> });

  const location = screen.getByRole("heading", { name: "Location" }).closest("section")!;
  expect(within(location).getByText("The map")).toBeDefined();
  expect(within(location).queryByText("31 Saryan Street, Yerevan")).toBeNull();
  expect(screen.getAllByText("31 Saryan Street, Yerevan")).toHaveLength(1);
});

test("booking comes straight after the name, in its own panel, and saving sits beside the name", () => {
  renderDetails({ booking: <p>The booking widget</p>, save: <button>Save</button> });

  expect(screen.getAllByRole("heading", { level: 2 })[0]?.textContent).toBe("Reserve a table");
  const title = screen.getByRole("heading", { level: 1 });
  expect(title.nextElementSibling?.textContent).toBe("Save");
});

test("Get directions opens a new tab, safely, and says so", () => {
  renderDetails();

  const maps = screen.getByRole("link", { name: "Get directions, opens in a new tab" });
  expect(maps.getAttribute("href")).toBe(tsiranPage.mapsUrl);
  expect(maps.getAttribute("target")).toBe("_blank");
  expect(maps.getAttribute("rel")).toBe("noopener noreferrer");
});

test("the phone number calls, and a website shows its plain name", () => {
  renderDetails({
    restaurant: { ...tsiranPage, website: "https://www.tsiran.example/menu" },
  });

  const contact = screen.getByRole("heading", { name: "Contact" }).closest("section")!;
  expect(
    within(contact)
      .getAllByRole("term")
      .map((term) => term.textContent),
  ).toEqual(["Phone", "Website"]);
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
  const reviews = screen.getByRole("heading", { name: "Reviews" }).closest("section")!;
  expect(within(reviews).getByText(/^Rated/).textContent).toBe("Rated 4.6 out of 5 by 23 guests.");
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

  const [cover, beside, onPhones] = [...page.querySelectorAll("img")];
  expect(cover?.getAttribute("srcset")).toBe(
    `${at(photo("room"), 800)} 800w, ${at(photo("room"), 1600)} 1600w`,
  );
  // The other photo goes beside the cover from 1024px, and under the details on a phone: it's
  // there twice, and CSS shows one or the other.
  expect(beside?.getAttribute("src")).toBe(at(photo("glass"), 600));
  expect(beside?.parentElement?.className).toContain("max-lg:hidden");
  const more = screen.getByRole("list", { name: "More photos" });
  expect(more.contains(onPhones ?? null)).toBe(true);
  expect(onPhones?.getAttribute("src")).toBe(at(photo("glass"), 600));
  expect(more.className).toContain("lg:hidden");
  // With a photo, the title sits below it in ink, not on a tone.
  expect(screen.getByRole("heading", { level: 1 }).parentElement?.className).not.toMatch(/tone/);
});

test("beside the cover go four photos, and any others follow lower on the page", () => {
  const names = ["room", "glass", "cellar", "plate", "terrace", "bar", "table"];
  renderDetails({
    restaurant: {
      ...tsiranPage,
      coverPhotoUrl: photo("room"),
      photos: names.map((name, index) => ({
        url: photo(name),
        isCover: index === 0,
        credit: null,
        creditUrl: null,
      })),
    },
  });

  // On a phone the four beside the cover wait here too, before the others. From 1024px they're
  // beside the cover instead, so here they're hidden, and only the two others show.
  const more = screen.getByRole("list", { name: "More photos" });
  expect(
    within(more)
      .getAllByRole("listitem")
      .map((item) => [
        item.querySelector("img")?.getAttribute("src"),
        item.classList.contains("lg:hidden"),
      ]),
  ).toEqual([
    [at(photo("glass"), 600), true],
    [at(photo("cellar"), 600), true],
    [at(photo("plate"), 600), true],
    [at(photo("terrace"), 600), true],
    [at(photo("bar"), 600), false],
    [at(photo("table"), 600), false],
  ]);
  expect(more.className).not.toContain("lg:hidden");
  // The cover and the four beside it, then all six under the details.
  expect(screen.getByRole("article").querySelectorAll("img")).toHaveLength(11);
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
  expect(screen.getAllByRole("heading", { level: 5 })).toHaveLength(5);
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
      "Reserve a table",
      "Opening hours",
      "Contact",
      "Location",
      "Reviews",
    ]);
    const note = screen.getByText("This is a test booking. The restaurant won’t receive it.");
    expect(note.closest("section")?.querySelector("h2")?.textContent).toBe("Reserve a table");
    expect(note.compareDocumentPosition(screen.getByText("The booking widget"))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(
      screen.getByText("No reviews yet. Guests can leave one after their visit."),
    ).toBeDefined();
    // Credited as OpenStreetMap asks, and as Geoapify's free plan asks beside what its API
    // returned, in one line, once, right under the line that says what it is.
    const copyright = screen.getByRole("link", { name: /OpenStreetMap contributors/ });
    expect(copyright.getAttribute("href")).toBe("https://www.openstreetmap.org/copyright");
    const credit = copyright.parentElement;
    expect(credit?.textContent).toMatch(
      /^Details © OpenStreetMap contributors.*, through Geoapify[^.]*$/,
    );
    expect(credit?.parentElement?.previousElementSibling).toBe(aboutLine());
    expect(screen.getAllByText(/^Details ©/)).toHaveLength(1);
    expect(screen.getByRole("link", { name: /Geoapify/ }).getAttribute("href")).toBe(
      "https://www.geoapify.com/",
    );
    // No badge or heading saying it's a demo, and no link to its place at OpenStreetMap.
    expect(screen.queryByText(/Demo listing|public listings|may have changed/)).toBeNull();
    expect(screen.queryByRole("link", { name: /See it on OpenStreetMap/ })).toBeNull();
    // No price: just its cuisine and address under the name.
    expect(aboutParts()).toEqual(["Middle Eastern", "4/6 King Pap Street, Yerevan"]);
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
    // Said once, under the line that says what it is.
    expect(screen.getAllByText(/^Photos:/)).toHaveLength(1);
    expect(credits.parentElement?.previousElementSibling).toBe(aboutLine());
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

  // Only its address under the name, where a cuisine would be first.
  expect(aboutParts()).toEqual(["23 Tumanyan Street, Yerevan"]);
  expect(screen.getByText("Opening hours aren’t listed yet.")).toBeDefined();
  expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
    "Opening hours",
    "Location",
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
