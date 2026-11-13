// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import { RestaurantMap } from "@/features/restaurants/components/RestaurantMap";

afterEach(cleanup);

const SRC = "/api/restaurants/lori-smokehouse/map";
const MAPS = "https://www.google.com/maps/search/?api=1&query=Lori";

const renderMap = (props: Partial<Parameters<typeof RestaurantMap>[0]> = {}) =>
  render(<RestaurantMap src={SRC} mapsUrl={MAPS} {...props} />).container;

test("no map set up: nothing at all, not an empty frame", () => {
  expect(renderMap({ src: null }).innerHTML).toBe("");
});

test("the picture opens Google Maps, but only for the mouse: the text link under the address is the one for everyone", () => {
  const link = renderMap().querySelector("a")!;

  expect(link.getAttribute("href")).toBe(MAPS);
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  expect(link.getAttribute("aria-hidden")).toBe("true");
  expect(link.getAttribute("tabindex")).toBe("-1");
});

test("the picture loads lazily from our own API, and fades in once it has come", () => {
  const image = renderMap().querySelector("img")!;

  expect(image.getAttribute("src")).toBe(SRC);
  expect(image.getAttribute("alt")).toBe("");
  expect(image.getAttribute("loading")).toBe("lazy");
  expect(image.className).toContain("opacity-0");

  fireEvent.load(image);

  expect(image.className).toContain("opacity-100");
});

test("a wine pin marks the place, its point at the middle, once the picture has come", () => {
  const container = renderMap();
  expect(container.querySelector("a > span")).toBeNull();

  fireEvent.load(container.querySelector("img")!);

  const pin = container.querySelector("a > span")!;
  expect(pin.className).toContain("top-1/2");
  expect(pin.className).toContain("left-1/2");
  // Centred across, and lifted by its whole height, so its point, at its foot, is on the place.
  expect(pin.className).toContain("-translate-x-1/2");
  expect(pin.className).toContain("-translate-y-full");
  expect(pin.querySelector("span")?.className).toContain("bg-accent");
});

test("a picture that can't load, from no address found or Geoapify failing, takes the frame with it", () => {
  const container = renderMap();

  fireEvent.error(container.querySelector("img")!);

  expect(container.innerHTML).toBe("");
});

test("for /design: loading is the empty frame, and unavailable is nothing", () => {
  const loading = renderMap({ hold: "loading", src: null });
  expect(loading.querySelector("a")).not.toBeNull();
  expect(loading.querySelector("img")).toBeNull();
  expect(loading.querySelector("a > span")).toBeNull();
  cleanup();

  expect(renderMap({ hold: "unavailable" }).innerHTML).toBe("");
});
