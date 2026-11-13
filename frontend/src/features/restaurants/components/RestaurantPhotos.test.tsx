// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, expect, test } from "vitest";

import { RestaurantPhotos } from "@/features/restaurants/components/RestaurantPhotos";

afterEach(cleanup);

const photo = (name: string): string =>
  `https://res.cloudinary.com/seghan/image/upload/v1/tsiran/${name}.jpg`;

function renderPhotos(props: Partial<ComponentProps<typeof RestaurantPhotos>> = {}): HTMLElement {
  const { container } = render(
    <RestaurantPhotos
      name="Tsiran Wine Room"
      slug="tsiran-wine-room"
      cover={photo("room")}
      beside={[]}
      whole={false}
      {...props}
    />,
  );
  return container;
}

/** Each tile beside the cover, by the spans it takes from 1024px. */
const spans = (container: HTMLElement): string[] =>
  [...container.querySelectorAll("img")].slice(1).map((img) => {
    const tile = img.parentElement?.className ?? "";
    return tile
      .split(" ")
      .filter((name) => /^lg:(col|row)-span/.test(name))
      .join(" ");
  });

test("with no photo, the menu cover stands in, and screen readers skip it", () => {
  const container = renderPhotos({ cover: null });

  expect(container.querySelector("img")).toBeNull();
  const cover = container.querySelector('[aria-hidden="true"]');
  expect(cover?.textContent).toBe("Tsiran Wine Room");
  expect(cover?.className).toMatch(/bg-tone-[1-6]/);
});

test("a cover alone is a wide banner, at two sizes, as decoration", () => {
  const container = renderPhotos();

  const [cover, ...others] = [...container.querySelectorAll("img")];
  expect(others).toHaveLength(0);
  expect(cover?.getAttribute("alt")).toBe("");
  expect(cover?.getAttribute("srcset")).toContain("w_800/");
  expect(cover?.getAttribute("srcset")).toContain("w_1600/");
  expect(cover?.parentElement?.className).toContain("lg:aspect-21/9");
});

test.each([
  [1, ["lg:col-span-2 lg:row-span-2"]],
  [2, ["lg:col-span-2", "lg:col-span-2"]],
  [3, ["lg:row-span-2", "", ""]],
  [4, ["", "", "", ""]],
])("%i beside the cover share its height without a gap", (count, expected) => {
  const beside = ["glass", "cellar", "plate", "terrace"].slice(0, count).map(photo);
  const container = renderPhotos({ beside });

  expect(spans(container)).toEqual(expected);
  // Small, lazy pictures: they're below the cover on a phone.
  const tiles = [...container.querySelectorAll("img")].slice(1);
  expect(tiles.every((img) => img.getAttribute("loading") === "lazy")).toBe(true);
  expect(tiles[0]?.getAttribute("src")).toContain("w_600/");
});

test("a cover a crop would spoil is shown whole, on the paper tint", () => {
  const container = renderPhotos({ whole: true, beside: [photo("glass")] });

  const cover = container.querySelector("img");
  expect(cover?.className).toContain("object-contain");
  expect(cover?.className).toContain("bg-surface-tinted");
});
