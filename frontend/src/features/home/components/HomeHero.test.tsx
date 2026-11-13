// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test } from "vitest";

import { HomeHero } from "@/features/home/components/HomeHero";
import { HOME_CUISINES } from "@/features/home/home";

afterEach(cleanup);

const TODAY = "2026-11-13";
// The table the search starts at: tonight, at 19:30, for two.
const TONIGHT = { date: TODAY, time: "19:30", guests: 2 };

function renderHero(props: Partial<ComponentProps<typeof HomeHero>> = {}): void {
  render(
    <MemoryRouter>
      <HomeHero query={TONIGHT} today={TODAY} {...props} />
    </MemoryRouter>,
  );
}

test("says where, with how many restaurants once known, then the headline and the search", () => {
  renderHero({ total: 16 });

  expect(screen.getByText("Yerevan · 16 restaurants taking bookings")).toBeDefined();
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
    "Find a table in Yerevan, tonight or any night.",
  );
  const search = screen.getByRole("search", { name: "Find a table" });
  // It starts at the table it's given.
  expect(within(search).getByRole<HTMLSelectElement>("combobox", { name: "Date" }).value).toBe(
    TODAY,
  );
  expect(within(search).getByRole<HTMLSelectElement>("combobox", { name: "Time" }).value).toBe(
    "19:30",
  );
  expect(within(search).getByRole<HTMLSelectElement>("combobox", { name: "Guests" }).value).toBe(
    "2",
  );
});

test("before the count comes, it says Yerevan alone", () => {
  renderHero();

  expect(screen.getByText("Yerevan")).toBeDefined();
});

test("each cuisine opens Browse filtered to it", () => {
  renderHero();

  const cuisines = within(screen.getByRole("navigation", { name: "Cuisines" })).getAllByRole(
    "link",
  );
  expect(cuisines).toHaveLength(HOME_CUISINES.length);
  expect(screen.getByRole("link", { name: "Georgian" }).getAttribute("href")).toBe(
    "/restaurants?cuisine=GEORGIAN",
  );
});

test("in /design, the headline steps down, so that page keeps its one h1", () => {
  renderHero({ heading: "h4" });

  expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  expect(screen.getByRole("heading", { level: 4 })).toBeDefined();
});
