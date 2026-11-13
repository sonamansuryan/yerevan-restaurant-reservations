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
  expect(shown(null)).toEqual(["Discover /restaurants", "For restaurants /register?role=owner"]);
  expect(shown(person("CUSTOMER"))).toEqual([
    "Discover /restaurants",
    "My reservations /reservations",
    "My favorites /favorites",
  ]);
  expect(shown(person("OWNER"))).toEqual(["Discover /restaurants", "Dashboard /dashboard"]);
  expect(shown(person("ADMIN"))).toEqual(["Discover /restaurants", "Admin /admin"]);
});

test("while the app is still asking who's signed in, only Discover", () => {
  expect(shown(undefined)).toEqual(["Discover /restaurants"]);
});

test("Reserve a table is for guests and anyone signed out, and shows while the app is still asking", () => {
  expect(offersReserve(undefined)).toBe(true);
  expect(offersReserve(null)).toBe(true);
  expect(offersReserve(person("CUSTOMER"))).toBe(true);
  // Owners and admins never book.
  expect(offersReserve(person("OWNER"))).toBe(false);
  expect(offersReserve(person("ADMIN"))).toBe(false);
});
