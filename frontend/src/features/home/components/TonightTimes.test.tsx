// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test } from "vitest";

import { TonightTimes } from "@/features/home/components/TonightTimes";
import type { TonightState } from "@/features/home/home";

afterEach(cleanup);

function renderTimes(state: TonightState): void {
  render(
    <MemoryRouter>
      <TonightTimes slug="dolmama" name="Dolmama" date="2026-11-13" state={state} />
    </MemoryRouter>,
  );
}

test("each time links into the booking at that time, and says so to screen readers", () => {
  renderTimes({ status: "ready", times: ["19:00", "19:30", "20:00"] });

  const list = screen.getByRole("list", { name: "Free tonight at Dolmama" });
  const links = within(list).getAllByRole("link");
  expect(links.map((link) => link.textContent)).toEqual(["19:00", "19:30", "20:00"]);
  expect(links[0]?.getAttribute("aria-label")).toBe("Book Dolmama tonight at 19:00");
  expect(links[0]?.getAttribute("href")).toBe(
    "/restaurants/dolmama?date=2026-11-13&guests=2&time=19%3A00",
  );
});

test("while the times load, three blanks hold their place, and screen readers hear why", () => {
  renderTimes({ status: "loading" });

  const status = screen.getByRole("status");
  expect(status.textContent).toBe("Finding free tables at Dolmama");
  expect(status.querySelectorAll("[aria-hidden='true']")).toHaveLength(3);
  expect(screen.queryByRole("link")).toBeNull();
});

test("with no table free tonight, it says so and offers another time", () => {
  renderTimes({ status: "ready", times: [] });

  expect(screen.getByText("No tables free tonight.")).toBeDefined();
  expect(screen.getByRole("link", { name: "Choose another time" }).getAttribute("href")).toBe(
    "/restaurants/dolmama",
  );
  expect(screen.queryByRole("list")).toBeNull();
});

test("when the times can't load, it says so and links to them", () => {
  renderTimes({ status: "failed" });

  expect(screen.getByText("Couldn’t load the times.")).toBeDefined();
  expect(screen.getByRole("link", { name: "See its times" }).getAttribute("href")).toBe(
    "/restaurants/dolmama",
  );
});
