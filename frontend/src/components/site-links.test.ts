import { expect, test } from "vitest";

import { mainLinks } from "@/components/site-links";
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
  ]);
  expect(shown(person("OWNER"))).toEqual(["Discover /restaurants", "Dashboard /dashboard"]);
});

test("while the app is still asking who's signed in, and for an admin, only Discover", () => {
  expect(shown(undefined)).toEqual(["Discover /restaurants"]);
  expect(shown(person("ADMIN"))).toEqual(["Discover /restaurants"]);
});
