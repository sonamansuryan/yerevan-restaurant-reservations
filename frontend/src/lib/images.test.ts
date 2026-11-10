import { expect, test } from "vitest";

import { photoUrl } from "@/lib/images";

test("a Cloudinary photo asks for the best format and quality, at the width given", () => {
  expect(photoUrl("https://res.cloudinary.com/seghan/image/upload/v17/nurr/room.jpg", 800)).toBe(
    "https://res.cloudinary.com/seghan/image/upload/f_auto,q_auto,w_800/v17/nurr/room.jpg",
  );
});

test("any other address is used as it is", () => {
  expect(photoUrl("https://example.com/image/upload/room.jpg", 800)).toBe(
    "https://example.com/image/upload/room.jpg",
  );
  expect(photoUrl("https://res.cloudinary.com/seghan/video/upload/clip.mp4", 800)).toBe(
    "https://res.cloudinary.com/seghan/video/upload/clip.mp4",
  );
});
