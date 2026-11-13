// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test } from "vitest";

import { FreeTimes } from "@/features/restaurants/components/FreeTimes";
import type { FreeTimesState } from "@/features/restaurants/components/FreeTimes";
import { dayLink, freeTimeLink } from "@/features/restaurants/tableSearch";
import type { TableQuery } from "@/features/restaurants/tableSearch";

afterEach(cleanup);

// As Browse wires it: each time opens the restaurant's page with the booking at that time.
const query: TableQuery = { date: "2026-11-14", time: "19:30", guests: 4 };

function renderTimes(state: FreeTimesState, when = "on Saturday 14 November"): void {
  render(
    <MemoryRouter>
      <FreeTimes
        name="Lori Smokehouse"
        state={state}
        when={when}
        linkFor={(time) => freeTimeLink("lori-smokehouse", query, time)}
        pageLink={dayLink("lori-smokehouse", query)}
      />
    </MemoryRouter>,
  );
}

test("each time is a link into the booking at that time, named in full for screen readers", () => {
  renderTimes({ status: "ready", times: ["19:00", "19:30", "20:00"] });

  const list = screen.getByRole("list", {
    name: "Free on Saturday 14 November at Lori Smokehouse",
  });
  const links = within(list).getAllByRole("link");
  expect(links.map((link) => link.textContent)).toEqual(["19:00", "19:30", "20:00"]);
  expect(links.map((link) => link.getAttribute("aria-label"))).toEqual([
    "Book Lori Smokehouse on Saturday 14 November at 19:00",
    "Book Lori Smokehouse on Saturday 14 November at 19:30",
    "Book Lori Smokehouse on Saturday 14 November at 20:00",
  ]);
  expect(links[2]?.getAttribute("href")).toBe(
    "/restaurants/lori-smokehouse?date=2026-11-14&guests=4&time=20%3A00",
  );
});

test("today's times say today", () => {
  renderTimes({ status: "ready", times: ["21:00"] }, "today");

  expect(
    screen.getByRole("link", { name: "Book Lori Smokehouse today at 21:00" }).getAttribute("href"),
  ).toBe("/restaurants/lori-smokehouse?date=2026-11-14&guests=4&time=21%3A00");
});

test("while the times load, three blanks hold their place, and screen readers hear why", () => {
  renderTimes({ status: "loading" });

  const status = screen.getByRole("status");
  expect(status.textContent).toBe("Finding free tables at Lori Smokehouse");
  expect(status.querySelectorAll("[aria-hidden='true']")).toHaveLength(3);
  expect(screen.queryByRole("link")).toBeNull();
});

test("with no table free, it says so and links to the restaurant's page to choose another time", () => {
  renderTimes({ status: "ready", times: [] });

  expect(screen.getByText(/^No tables free on Saturday 14 November\./)).toBeDefined();
  expect(screen.getByRole("link", { name: "Choose another time" }).getAttribute("href")).toBe(
    "/restaurants/lori-smokehouse?date=2026-11-14&guests=4",
  );
  expect(screen.queryByRole("list")).toBeNull();
});

test("when the times can't load, it says so and links to them", () => {
  renderTimes({ status: "failed" });

  expect(screen.getByText(/^Couldn’t load the times\./)).toBeDefined();
  expect(screen.getByRole("link", { name: "See its times" }).getAttribute("href")).toBe(
    "/restaurants/lori-smokehouse?date=2026-11-14&guests=4",
  );
  expect(screen.queryByRole("list")).toBeNull();
});
