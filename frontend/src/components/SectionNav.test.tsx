// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, expect, test } from "vitest";

import { SectionNav } from "@/components/SectionNav";

afterEach(cleanup);

const links = [
  { to: "/dashboard/r-1", label: "Bookings", end: true },
  { to: "/dashboard/r-1/details", label: "Information" },
  { to: "/dashboard/r-1/hours", label: "Opening hours" },
];

function renderAt(path: string): void {
  const router = createMemoryRouter(
    [{ path: "*", element: <SectionNav label="Lori Smokehouse" links={links} /> }],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
}

test("the links are named by the place they belong to", () => {
  renderAt("/dashboard/r-1");

  const nav = screen.getByRole("navigation", { name: "Lori Smokehouse" });
  expect(
    within(nav)
      .getAllByRole("link")
      .map((link) => link.textContent),
  ).toEqual(["Bookings", "Information", "Opening hours"]);
});

test("the part you're on is marked as the current page, and only that one", () => {
  renderAt("/dashboard/r-1/hours");

  const current = screen
    .getAllByRole("link")
    .filter((link) => link.getAttribute("aria-current") === "page");
  expect(current.map((link) => link.textContent)).toEqual(["Opening hours"]);
});

test("a part at its parent's own address isn't marked on the other parts", () => {
  renderAt("/dashboard/r-1/details");

  expect(screen.getByRole("link", { name: "Bookings" }).getAttribute("aria-current")).toBeNull();
  expect(screen.getByRole("link", { name: "Information" }).getAttribute("aria-current")).toBe(
    "page",
  );
});
