import { expect, test } from "vitest";

import { mainLinks, offersReserve } from "@/components/site-links";
import type { AuthUser } from "@/types/api";

const person = (role: AuthUser["role"]): AuthUser => ({
  id: "user-1",
  email: "lilit@example.com",
  name: "Lilit Harutyunyan",
  phone: null,
  role,
});
const shown = (user: AuthUser | null | undefined): string[] =>
  mainLinks(user).map(({ label, to }) => `${label} ${to}`);

test("the main links follow who's signed in", () => {
  // Signed out, My reservations is still offered: its page asks to sign in first.
  expect(shown(null)).toEqual([
    "Explore /restaurants",
    "Neighborhoods /#neighborhoods",
    "My reservations /reservations",
  ]);
  expect(shown(person("CUSTOMER"))).toEqual([
    "Explore /restaurants",
    "Neighborhoods /#neighborhoods",
    "My reservations /reservations",
    "My favorites /favorites",
  ]);
  expect(shown(person("OWNER"))).toEqual([
    "Explore /restaurants",
    "Neighborhoods /#neighborhoods",
    "Dashboard /dashboard",
  ]);
  expect(shown(person("ADMIN"))).toEqual([
    "Explore /restaurants",
    "Neighborhoods /#neighborhoods",
    "Admin /admin",
  ]);
});

test("while the app is still asking who's signed in, only Explore and Neighborhoods", () => {
  expect(shown(undefined)).toEqual(["Explore /restaurants", "Neighborhoods /#neighborhoods"]);
});

test("Neighborhoods is a part of the home page, so it never marks a page as current", () => {
  const [, neighborhoods] = mainLinks(null);

  expect(neighborhoods?.marksPage).toBe(false);
});

test("Find a table is for guests and anyone signed out, and shows while the app is still asking", () => {
  expect(offersReserve(undefined)).toBe(true);
  expect(offersReserve(null)).toBe(true);
  expect(offersReserve(person("CUSTOMER"))).toBe(true);
  // Owners and admins never book.
  expect(offersReserve(person("OWNER"))).toBe(false);
  expect(offersReserve(person("ADMIN"))).toBe(false);
});
