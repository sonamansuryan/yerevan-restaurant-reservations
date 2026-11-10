// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import type { Mock } from "vitest";

import type { BrowseFilters } from "@/features/restaurants/browseFilters";
import { RestaurantFilters } from "@/features/restaurants/components/RestaurantFilters";

afterEach(cleanup);

function renderFilters(filters: BrowseFilters = { page: 3 }): Mock {
  const onChange = vi.fn();
  render(<RestaurantFilters filters={filters} onChange={onChange} />);
  return onChange;
}

test("choosing a cuisine applies at once, back on page 1", async () => {
  const onChange = renderFilters({ district: "KENTRON", page: 3 });

  await userEvent.selectOptions(screen.getByLabelText("Cuisine"), "Georgian");

  expect(onChange).toHaveBeenCalledWith({ district: "KENTRON", cuisine: "GEORGIAN", page: 1 });
});

test("choosing Any clears that filter", async () => {
  const onChange = renderFilters({ price: 2, page: 1 });

  await userEvent.selectOptions(screen.getByLabelText("Price"), "Any price");

  expect(onChange).toHaveBeenCalledWith({ price: undefined, page: 1 });
});

test("a search applies when it's sent, trimmed, and not at every letter", async () => {
  const onChange = renderFilters();

  await userEvent.type(screen.getByLabelText("Search"), "  khachapuri ");
  expect(onChange).not.toHaveBeenCalled();
  await userEvent.keyboard("{Enter}");

  expect(onChange).toHaveBeenCalledWith({ q: "khachapuri", page: 1 });
});

test("sending an empty search clears it", async () => {
  const onChange = renderFilters({ q: "wine", page: 2 });

  await userEvent.clear(screen.getByLabelText("Search"));
  await userEvent.click(screen.getByRole("button", { name: "Search" }));

  expect(onChange).toHaveBeenCalledWith({ q: undefined, page: 1 });
});

test("shows the filters in use, and lists the choices alphabetically", () => {
  renderFilters({ q: "wine", cuisine: "SEAFOOD", district: "NOR_NORK", price: 3, page: 1 });

  expect(screen.getByLabelText<HTMLInputElement>("Search").value).toBe("wine");
  expect(screen.getByLabelText<HTMLSelectElement>("Cuisine").value).toBe("SEAFOOD");
  expect(screen.getByLabelText<HTMLSelectElement>("District").value).toBe("NOR_NORK");
  expect(screen.getByLabelText<HTMLSelectElement>("Price").value).toBe("3");
  const cuisines = within(screen.getByLabelText("Cuisine"))
    .getAllByRole("option")
    .map((option) => option.textContent);
  expect(cuisines.slice(0, 4)).toEqual(["Any cuisine", "Armenian", "Asian", "European"]);
  expect(screen.getByRole("option", { name: "֏֏֏ Expensive" })).toBeDefined();
});

test("the whole form is a search landmark named Restaurants", () => {
  renderFilters();

  expect(screen.getByRole("search", { name: "Restaurants" })).toBeDefined();
});
