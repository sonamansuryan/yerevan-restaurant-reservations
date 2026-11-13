// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, test } from "vitest";

import { CalendarIcon, TableIcon } from "@/components/icons";
import { SideNav } from "@/components/SideNav";
import type { SideLink } from "@/components/SideNav";

afterEach(cleanup);

const bookings: SideLink = {
  to: "/dashboard/r-1",
  label: "Bookings",
  icon: <CalendarIcon />,
  end: true,
};
const tables: SideLink = { to: "/dashboard/r-1/tables", label: "Tables", icon: <TableIcon /> };
const links = [bookings, tables];

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <SideNav
        label="Lori Smokehouse"
        links={links}
        header={<h1>Lori Smokehouse</h1>}
        footer={<a href="/restaurants/lori-smokehouse">See the guests’ page</a>}
      />
    </MemoryRouter>,
  );
}

test("its links are a navigation named after the place, each named by its label alone", () => {
  renderAt("/dashboard/r-1/tables");

  const nav = within(screen.getByRole("navigation", { name: "Lori Smokehouse" }));
  expect(nav.getAllByRole("link").map((link) => link.textContent)).toEqual(["Bookings", "Tables"]);
  for (const link of nav.getAllByRole("link")) {
    expect(link.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  }
});

test("the part you're on is marked as the current page, and only that one", () => {
  renderAt("/dashboard/r-1/tables");

  expect(screen.getByRole("link", { name: "Tables" }).getAttribute("aria-current")).toBe("page");
  // Bookings lives at the place's own address, so it's marked only there.
  expect(screen.getByRole("link", { name: "Bookings" }).getAttribute("aria-current")).toBeNull();
});

test("its header comes before the links, and its footer after them", () => {
  renderAt("/dashboard/r-1");

  const heading = screen.getByRole("heading", { level: 1 });
  const nav = screen.getByRole("navigation");
  const footer = screen.getByRole("link", { name: "See the guests’ page" });
  expect(heading.compareDocumentPosition(nav)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  expect(nav.compareDocumentPosition(footer)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
});

describe("a count beside a link", () => {
  function renderWithCount(value: number): void {
    const counted = [{ ...bookings, count: { value, label: `${value} to confirm` } }, tables];
    render(
      <MemoryRouter initialEntries={["/dashboard/r-1/tables"]}>
        <SideNav label="Lori Smokehouse" links={counted} header={<h1>Lori Smokehouse</h1>} />
      </MemoryRouter>,
    );
  }

  test("it shows as a pill, and screen readers hear it after the link's name", () => {
    renderWithCount(3);

    const bookings = screen.getByRole("link", { name: "Bookings, 3 to confirm" });
    // The pill's number is for the eye: the words after the name say it in full.
    const number = within(bookings).getByText("3");
    expect(number.getAttribute("aria-hidden")).toBe("true");
    expect(within(bookings).getByText(", 3 to confirm").className).toContain("sr-only");
  });

  test("at 0 there's no pill, and the link is named by its label alone", () => {
    renderWithCount(0);

    expect(screen.getByRole("link", { name: "Bookings" }).textContent).toBe("Bookings");
  });
});

test("the logo comes first, linking home", () => {
  renderAt("/dashboard/r-1");

  const [first] = screen.getAllByRole("link");
  expect(first?.getAttribute("aria-label")).toBe("Seghan, home");
  expect(first?.getAttribute("href")).toBe("/");
});

test("who's signed in is shown once, though phones and wide screens put it in different places", () => {
  render(
    <MemoryRouter initialEntries={["/dashboard/r-1"]}>
      <SideNav
        label="Lori Smokehouse"
        links={links}
        header={<h1>Lori Smokehouse</h1>}
        account={<button type="button">Sign out</button>}
      />
    </MemoryRouter>,
  );

  expect(screen.getAllByRole("button", { name: "Sign out" })).toHaveLength(1);
});

test("without a footer, the menu ends with its links", () => {
  render(
    <MemoryRouter initialEntries={["/dashboard/r-1"]}>
      <SideNav label="Lori Smokehouse" links={links} header={<h1>Lori Smokehouse</h1>} />
    </MemoryRouter>,
  );

  const nav = screen.getByRole("navigation", { name: "Lori Smokehouse" });
  expect(nav.nextElementSibling).toBeNull();
});
