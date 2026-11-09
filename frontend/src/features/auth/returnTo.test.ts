import { expect, test } from "vitest";

import { returnPath, returnStateFor } from "@/features/auth/returnTo";

test("a guard's state leads back to the page, with its query and #part", () => {
  const state = returnStateFor({ pathname: "/reservations", search: "?tab=past", hash: "#r-1" });

  expect(returnPath(state)).toBe("/reservations?tab=past#r-1");
});

test.each([
  ["no state at all", undefined],
  ["some other state", { scroll: 10 }],
  ["a from with no path", { from: {} }],
  ["a path that isn't text", { from: { pathname: 42 } }],
  ["a full address", { from: { pathname: "https://example.com/reservations" } }],
  ["a script address", { from: { pathname: "javascript:alert(1)" } }],
  ["another site, written with two slashes", { from: { pathname: "//example.com/reservations" } }],
  // Browsers read a backslash as a slash, and drop tabs and line breaks, so these are "//" too.
  ["another site, written with a backslash", { from: { pathname: "/\\example.com/reservations" } }],
  ["another site, with a tab between the slashes", { from: { pathname: "/\t/example.com" } }],
  ["something that isn't an address at all", { from: { pathname: "//" } }],
])("%s leads home", (_, state) => {
  expect(returnPath(state)).toBe("/");
});
