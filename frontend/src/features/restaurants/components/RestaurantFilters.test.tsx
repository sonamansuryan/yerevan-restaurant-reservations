// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import type { Mock } from "vitest";

import type { BrowseFilters } from "@/features/restaurants/browseFilters";
import { RestaurantFilters } from "@/features/restaurants/components/RestaurantFilters";

afterEach(cleanup);

// The table looked for, which the bar's day, time and party start at: tonight, for two.
const TODAY = "2026-11-13";
const TONIGHT = { date: TODAY, time: "19:30", guests: 2 };

function renderFilters(filters: BrowseFilters = { page: 3 }): Mock {
  const onChange = vi.fn();
  render(<RestaurantFilters filters={filters} onChange={onChange} query={TONIGHT} today={TODAY} />);
  return onChange;
}

const searchBox = (): HTMLInputElement =>
  screen.getByLabelText<HTMLInputElement>("Restaurant, dish or street");

test("choosing a cuisine applies at once, back on page 1", async () => {
  const onChange = renderFilters({ district: "KENTRON", page: 3 });

  await userEvent.selectOptions(screen.getByLabelText("Cuisine"), "Georgian");

  expect(onChange).toHaveBeenCalledWith({ district: "KENTRON", cuisine: "GEORGIAN", page: 1 });
});

test("Sort by applies at once, back on page 1, and Name puts it back", async () => {
  const onChange = renderFilters({ price: 2, page: 3 });

  expect((screen.getByLabelText("Sort by") as HTMLSelectElement).value).toBe("name");
  await userEvent.selectOptions(screen.getByLabelText("Sort by"), "Highest rated");
  expect(onChange).toHaveBeenLastCalledWith({ price: 2, sort: "rating", page: 1 });

  cleanup();
  const again = renderFilters({ sort: "rating", page: 1 });
  expect((screen.getByLabelText("Sort by") as HTMLSelectElement).value).toBe("rating");
  await userEvent.selectOptions(screen.getByLabelText("Sort by"), "Name");
  expect(again).toHaveBeenLastCalledWith({ sort: undefined, page: 1 });
});

test("choosing Any clears that filter", async () => {
  const onChange = renderFilters({ price: 2, page: 1 });

  await userEvent.selectOptions(screen.getByLabelText("Price"), "Any");

  expect(onChange).toHaveBeenCalledWith({ price: undefined, page: 1 });
});

test("a search applies when it's sent, trimmed, and not at every letter", async () => {
  const onChange = renderFilters();

  await userEvent.type(searchBox(), "  khachapuri ");
  expect(onChange).not.toHaveBeenCalled();
  await userEvent.keyboard("{Enter}");

  // With the table looked for, which the bar holds too.
  expect(onChange).toHaveBeenCalledWith({ q: "khachapuri", ...TONIGHT, page: 1 });
});

test("the day, time and party chosen in the bar are sent with the search", async () => {
  const onChange = renderFilters({ cuisine: "GEORGIAN", page: 2 });

  await userEvent.selectOptions(screen.getByLabelText("Date"), "Tomorrow, 14 Nov");
  await userEvent.selectOptions(screen.getByLabelText("Time"), "21:00");
  await userEvent.selectOptions(screen.getByLabelText("Guests"), "4 guests");
  expect(onChange).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Search" }));

  expect(onChange).toHaveBeenCalledWith({
    cuisine: "GEORGIAN",
    q: undefined,
    date: "2026-11-14",
    time: "21:00",
    guests: 4,
    page: 1,
  });
});

test("sending an empty search clears it", async () => {
  const onChange = renderFilters({ q: "wine", page: 2 });

  await userEvent.clear(searchBox());
  await userEvent.click(screen.getByRole("button", { name: "Search" }));

  expect(onChange).toHaveBeenCalledWith({ q: undefined, ...TONIGHT, page: 1 });
});

test("shows the filters in use, and lists the choices alphabetically", () => {
  renderFilters({ q: "wine", cuisine: "SEAFOOD", district: "NOR_NORK", price: 3, page: 1 });

  expect(searchBox().value).toBe("wine");
  expect(searchBox().getAttribute("placeholder")).toBe("Name, dish or street");
  expect(screen.getByLabelText<HTMLSelectElement>("Date").value).toBe(TODAY);
  expect(screen.getByLabelText<HTMLSelectElement>("Time").value).toBe("19:30");
  expect(screen.getByLabelText<HTMLSelectElement>("Guests").value).toBe("2");
  expect(screen.getByLabelText<HTMLSelectElement>("Cuisine").value).toBe("SEAFOOD");
  expect(screen.getByLabelText<HTMLSelectElement>("District").value).toBe("NOR_NORK");
  expect(screen.getByLabelText<HTMLSelectElement>("Price").value).toBe("3");
  const cuisines = within(screen.getByLabelText("Cuisine"))
    .getAllByRole("option")
    .map((option) => option.textContent);
  expect(cuisines.slice(0, 4)).toEqual(["Any", "Armenian", "Asian", "European"]);
  expect(screen.getByRole("option", { name: "֏֏֏ Expensive" })).toBeDefined();
});

test("each pill shows what it chooses and the choice in use", () => {
  renderFilters({ cuisine: "SEAFOOD", page: 1 });

  // The words on the pill, which screen readers skip, as they hear the select itself.
  const shown = (label: string): (string | null)[] =>
    [...(screen.getByLabelText(label).parentElement?.querySelectorAll(":scope > span") ?? [])].map(
      (span) => span.textContent,
    );
  expect(shown("Cuisine")).toEqual(["Cuisine", "Seafood"]);
  expect(shown("District")).toEqual(["District", "Any"]);
});

test("the whole form is a search landmark named Restaurants", () => {
  renderFilters();

  expect(screen.getByRole("search", { name: "Restaurants" })).toBeDefined();
});
