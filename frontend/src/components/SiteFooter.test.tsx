// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, test } from "vitest";

import { SiteFooter } from "@/components/SiteFooter";

beforeEach(() => {
  render(
    <MemoryRouter>
      <SiteFooter />
    </MemoryRouter>,
  );
});

afterEach(cleanup);

test("it closes with a host's words", () => {
  expect(screen.getByText("See you at the").textContent).toBe("See you at the table.");
});

test.each([
  ["All restaurants", "/restaurants"],
  ["Kentron", "/restaurants?district=KENTRON"],
  ["Arabkir", "/restaurants?district=ARABKIR"],
  ["Nor Nork", "/restaurants?district=NOR_NORK"],
  ["Malatia-Sebastia", "/restaurants?district=MALATIA_SEBASTIA"],
  ["Sign in", "/login"],
  ["Create an account", "/register"],
  ["My reservations", "/reservations"],
  ["My favorites", "/favorites"],
  ["List your restaurant", "/register?role=owner"],
  ["Owner dashboard", "/dashboard"],
  ["Seghan, home", "/"],
])("%s goes to %s", (name, href) => {
  expect(screen.getByRole("link", { name }).getAttribute("href")).toBe(href);
});

test("the columns have headings", () => {
  const headings = screen
    .getAllByRole("heading", { level: 2 })
    .map((heading) => heading.textContent);

  expect(headings).toEqual(["Explore", "Your table", "For restaurants"]);
});

test("its links are a named landmark", () => {
  expect(screen.getByRole("navigation", { name: "Footer" })).toBeDefined();
});

test("the year stays current", () => {
  expect(screen.getByText(`© ${new Date().getFullYear()} Seghan`)).toBeDefined();
});

test("the Armenian word is marked as Armenian, so screen readers pronounce it properly", () => {
  expect(screen.getByText("սեղան").getAttribute("lang")).toBe("hy");
  expect(screen.getByText("the Armenian word for table")).toBeDefined();
});

test.each(["Saved places", "Cascade", "Русский", "Հայերեն", "English"])(
  "%s stays out, as it's out of scope or not a district (§13.5)",
  (text) => {
    expect(screen.queryByText(text, { exact: false })).toBeNull();
  },
);
