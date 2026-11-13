import type { FormEvent, ReactElement } from "react";

import { PillSelect } from "@/components/PillSelect";
import type { PillOption } from "@/components/PillSelect";
import { isCuisine, isDistrict } from "@/features/restaurants/browseFilters";
import type { BrowseFilters } from "@/features/restaurants/browseFilters";
import { SearchBar } from "@/features/restaurants/components/SearchBar";
import {
  CUISINE_LABELS,
  DISTRICT_LABELS,
  PRICE_LEVELS,
  priceSigns,
  priceWords,
} from "@/features/restaurants/labels";
import { readSearch } from "@/features/restaurants/tableSearch";
import type { TableQuery } from "@/features/restaurants/tableSearch";
import { cx } from "@/lib/cx";

// Alphabetical, which is quicker to scan than the order the API lists them in. The pill already
// says what it's choosing, so "Any" is enough.
const withAny = (labels: Record<string, string>): PillOption[] => [
  { value: "", label: "Any" },
  ...Object.entries(labels)
    .sort(([, a], [, b]) => a.localeCompare(b))
    .map(([value, label]) => ({ value, label })),
];

const cuisineOptions = withAny(CUISINE_LABELS);
const districtOptions = withAny(DISTRICT_LABELS);
const priceOptions: PillOption[] = [
  { value: "", label: "Any" },
  ...PRICE_LEVELS.map((level) => ({
    value: String(level),
    label: `${priceSigns(level)} ${priceWords(level)}`,
  })),
];
const sortOptions: PillOption[] = [
  { value: "name", label: "Name" },
  { value: "rating", label: "Highest rated" },
];

interface RestaurantFiltersProps {
  filters: BrowseFilters;
  /** The new filters, always back on page 1, because the old page may no longer exist. */
  onChange: (filters: BrowseFilters) => void;
  /** The table looked for, which the bar's day, time and party show. */
  query: TableQuery;
  /** Today in Yerevan, the first day the bar offers. */
  today: string;
  className?: string;
}

/**
 * Search, cuisine, district and price, and the order: the search bar, with the day, time and party
 * of the table looked for, then the choices as pills. A choice applies at once, and its pill turns
 * ink while it narrows the list. The search applies when it's sent, with Enter or the button, so the
 * list doesn't reload at every letter. The bar holds what's chosen by itself: Browse gives it a new
 * key when the address changes, such as after Back, so it always shows the search in use.
 */
export function RestaurantFilters({
  filters,
  onChange,
  query,
  today,
  className,
}: RestaurantFiltersProps): ReactElement {
  const change = (next: Partial<BrowseFilters>): void => onChange({ ...filters, ...next, page: 1 });

  function search(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const { q, date, time, guests } = readSearch(event.currentTarget);
    change({ q, date, time, guests });
  }

  return (
    <form
      role="search"
      aria-label="Restaurants"
      onSubmit={search}
      className={cx("flex flex-col gap-4", className)}
    >
      <SearchBar
        label="Restaurant, dish or street"
        placeholder="Name, dish or street"
        defaultText={filters.q ?? ""}
        query={query}
        today={today}
        button="Search"
        className="border border-line shadow-search"
      />
      <div className="flex flex-wrap items-center gap-2">
        <PillSelect
          label="Cuisine"
          value={filters.cuisine ?? ""}
          options={cuisineOptions}
          active={filters.cuisine !== undefined}
          onChange={(value) => change({ cuisine: isCuisine(value) ? value : undefined })}
        />
        <PillSelect
          label="District"
          value={filters.district ?? ""}
          options={districtOptions}
          active={filters.district !== undefined}
          onChange={(value) => change({ district: isDistrict(value) ? value : undefined })}
        />
        <PillSelect
          label="Price"
          value={filters.price === undefined ? "" : String(filters.price)}
          options={priceOptions}
          active={filters.price !== undefined}
          onChange={(value) => change({ price: value ? Number(value) : undefined })}
        />
        {/* The order isn't a filter, so it never turns ink, and it stands apart on wider screens. */}
        <PillSelect
          label="Sort by"
          value={filters.sort ?? "name"}
          options={sortOptions}
          onChange={(value) => change({ sort: value === "rating" ? "rating" : undefined })}
          className="sm:ml-auto"
        />
      </div>
    </form>
  );
}
