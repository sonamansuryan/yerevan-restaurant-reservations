import { describe, expect, test } from "vitest";

import { contrastRatio, forcedSelector } from "@/features/design/tools";

describe("contrastRatio", () => {
  test("black on white is the highest possible, 21:1", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });

  test("a color on itself is 1:1", () => {
    expect(contrastRatio("#7a1e2c", "#7a1e2c")).toBeCloseTo(1, 5);
  });

  test("it matches the ratios measured for the app's colors", () => {
    expect(contrastRatio("#7a1e2c", "#fbfaf7")).toBeCloseTo(9.82, 2);
    expect(contrastRatio("#6f6a60", "#fbfaf7")).toBeCloseTo(5.15, 2);
  });

  test("the order of the two colors doesn't matter", () => {
    expect(contrastRatio("#fbfaf7", "#17140f")).toBe(contrastRatio("#17140f", "#fbfaf7"));
  });
});

describe("forcedSelector", () => {
  test.each([
    [".hover\\:bg-accent:hover", '.hover\\:bg-accent[data-force~="hover"]'],
    [".active\\:translate-y-px:active", '.active\\:translate-y-px[data-force~="active"]'],
    [".focus\\:border-accent:focus", '.focus\\:border-accent[data-force~="focus"]'],
    [":focus-visible", '[data-force~="focus"]'],
  ])("%s becomes a marker", (selector, expected) => {
    expect(forcedSelector(selector)).toBe(expected);
  });

  test.each([
    [".checked\\:hover\\:x:checked:hover", '.checked\\:hover\\:x:checked[data-force~="hover"]'],
    [".checked\\:focus\\:x:checked:focus", '.checked\\:focus\\:x:checked[data-force~="focus"]'],
    [".checked\\:active\\:x:checked:active", '.checked\\:active\\:x:checked[data-force~="active"]'],
  ])("%s keeps its class name, or the selector would be invalid", (selector, expected) => {
    expect(forcedSelector(selector)).toBe(expected);
  });

  test("a state on a parent changes too, as group-hover classes use", () => {
    expect(forcedSelector(".group-hover\\:x:is(:where(.group):hover *)")).toBe(
      '.group-hover\\:x:is(:where(.group)[data-force~="hover"] *)',
    );
  });

  test("every state in a selector list changes", () => {
    expect(forcedSelector(".a:hover, .b:hover")).toBe(
      '.a[data-force~="hover"], .b[data-force~="hover"]',
    );
  });

  test.each([".plain", ".checked\\:bg-accent:checked", ".box:focus-within"])(
    "%s has no state to copy, so it stays the same",
    (selector) => {
      expect(forcedSelector(selector)).toBe(selector);
    },
  );
});
