// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
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

test.each([
  ["Explore", "/restaurants"],
  ["Neighborhoods", "/#neighborhoods"],
  ["For restaurants", "/register?role=owner"],
])("%s goes to %s", (name, href) => {
  expect(screen.getByRole("link", { name }).getAttribute("href")).toBe(href);
});

test("its links are a named landmark, with just the three ways around the site", () => {
  const footer = within(screen.getByRole("navigation", { name: "Footer" }));

  expect(footer.getAllByRole("link").map((link) => link.textContent)).toEqual([
    "Explore",
    "Neighborhoods",
    "For restaurants",
  ]);
});

test("it's one row: the year, then the links, then the word for table", () => {
  const year = screen.getByText(`© ${new Date().getFullYear()} Seghan`);
  const links = screen.getByRole("navigation", { name: "Footer" });
  const word = screen.getByText("սեղան");

  expect(year.compareDocumentPosition(links)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  expect(links.compareDocumentPosition(word)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  // No columns, so no headings to name them.
  expect(screen.queryAllByRole("heading")).toHaveLength(0);
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
