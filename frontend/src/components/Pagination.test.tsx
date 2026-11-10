// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test } from "vitest";

import { Pagination } from "@/components/Pagination";

afterEach(cleanup);

function renderPages(page: number, pageCount: number): void {
  render(
    <MemoryRouter>
      <Pagination page={page} pageCount={pageCount} hrefFor={(to) => `/restaurants?page=${to}`} />
    </MemoryRouter>,
  );
}

test("nothing shows when everything fits on one page", () => {
  renderPages(1, 1);

  expect(screen.queryByRole("navigation")).toBeNull();
});

test("a page between has Previous and Next links around where you are", () => {
  renderPages(2, 4);

  const pages = screen.getByRole("navigation", { name: "Pages" });
  expect(pages.textContent).toContain("Page 2 of 4");
  expect(screen.getByRole("link", { name: "Previous" }).getAttribute("href")).toBe(
    "/restaurants?page=1",
  );
  expect(screen.getByRole("link", { name: "Next" }).getAttribute("href")).toBe(
    "/restaurants?page=3",
  );
});

test("the first page has no Previous, and the last no Next", () => {
  renderPages(1, 3);
  expect(screen.queryByRole("link", { name: "Previous" })).toBeNull();
  expect(screen.getByRole("link", { name: "Next" })).toBeDefined();
  cleanup();

  renderPages(3, 3);
  expect(screen.getByRole("link", { name: "Previous" })).toBeDefined();
  expect(screen.queryByRole("link", { name: "Next" })).toBeNull();
});
