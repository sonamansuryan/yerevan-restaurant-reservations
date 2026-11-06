import { expect, test } from "vitest";

import { cx } from "@/lib/cx";

test("it joins class names and skips empty ones", () => {
  expect(cx("a", false, null, undefined, "", "b")).toBe("a b");
});

test("nothing joins to an empty string", () => {
  expect(cx(false, undefined)).toBe("");
});
