import { expect, test } from "vitest";

import { isShownWhole } from "@/features/restaurants/covers";

const LISTINGS = "https://res.cloudinary.com/seghan/image/upload/v1794496094/seghan/demo-listings";

test("Gustav's bar photo is shown whole, known by its public ID, with or without an extension", () => {
  expect(isShownWhole(`${LISTINGS}/node-12246284869/466cc90a3f0cb4a9`)).toBe(true);
  expect(isShownWhole(`${LISTINGS}/node-12246284869/466cc90a3f0cb4a9.webp`)).toBe(true);
});

test("every other cover is cropped to fill its frame, PAUL's square one too", () => {
  expect(isShownWhole(`${LISTINGS}/node-11197827655/c8cbe22ed2549e9e`)).toBe(false);
  // Gustav's other photos, and an address that only ends like the bar photo's.
  expect(isShownWhole(`${LISTINGS}/node-12246284869/98e305a060fbb952`)).toBe(false);
  expect(isShownWhole(`${LISTINGS}/node-12246284869/x466cc90a3f0cb4a9`)).toBe(false);
  // An owner's own photo.
  expect(
    isShownWhole("https://res.cloudinary.com/seghan/image/upload/v1/seghan/restaurants/a1.jpg"),
  ).toBe(false);
});
