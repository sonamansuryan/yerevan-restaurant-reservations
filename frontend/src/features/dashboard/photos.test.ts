import { describe, expect, test } from "vitest";

import { photoProblem } from "@/features/dashboard/photos";

describe("a photo chosen to upload", () => {
  const file = (type: string, bytes: number): File =>
    new File([new Uint8Array(bytes)], "photo", { type });

  test("JPG, PNG and WebP photos up to 10 MB are fine", () => {
    expect(photoProblem(file("image/jpeg", 1000))).toBeNull();
    expect(photoProblem(file("image/png", 1000))).toBeNull();
    expect(photoProblem(file("image/webp", 10 * 1024 * 1024))).toBeNull();
  });

  test("anything else is refused before it's sent", () => {
    expect(photoProblem(file("image/gif", 1000))).toBe("Choose a JPG, PNG or WebP photo.");
    expect(photoProblem(file("application/pdf", 1000))).toBe("Choose a JPG, PNG or WebP photo.");
    expect(photoProblem(file("image/jpeg", 10 * 1024 * 1024 + 1))).toBe(
      "Choose a photo under 10 MB.",
    );
  });
});
