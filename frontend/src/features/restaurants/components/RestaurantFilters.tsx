import type { FormEvent, ReactElement } from "react";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { isCuisine, isDistrict } from "@/features/restaurants/browseFilters";
import type { BrowseFilters } from "@/features/restaurants/browseFilters";
import {
  CUISINE_LABELS,
  DISTRICT_LABELS,
  PRICE_LEVELS,
  priceSigns,
  priceWords,
} from "@/features/restaurants/labels";
import { cx } from "@/lib/cx";

// Alphabetical, which is quicker to scan than the order the API lists them in.
const byLabel = (labels: Record<string, string>): [string, string][] =>
  Object.entries(labels).sort(([, a], [, b]) => a.localeCompare(b));

const cuisineOptions = byLabel(CUISINE_LABELS);
const districtOptions = byLabel(DISTRICT_LABELS);

interface RestaurantFiltersProps {
  filters: BrowseFilters;
  /** The new filters, always back on page 1, because the old page may no longer exist. */
  onChange: (filters: BrowseFilters) => void;
  className?: string;
}

/**
 * Search, cuisine, district and price. A choice in a list applies at once. The search applies when
 * it's sent, with Enter or the button, so the list doesn't reload at every letter. The search box
 * holds what's typed by itself: Browse gives it a new key when the address's search changes, such
 * as after Back, so it always shows the search in use.
 */
export function RestaurantFilters({
  filters,
  onChange,
  className,
}: RestaurantFiltersProps): ReactElement {
  const change = (next: Partial<BrowseFilters>): void => onChange({ ...filters, ...next, page: 1 });

  function search(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const text = new FormData(event.currentTarget).get("q");
    change({ q: typeof text === "string" && text.trim() ? text.trim() : undefined });
  }

  return (
    <form
      role="search"
      aria-label="Restaurants"
      onSubmit={search}
      className={cx(
        "grid grid-cols-2 items-end gap-x-6 gap-y-5 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto]",
        className,
      )}
    >
      <Input
        label="Search"
        name="q"
        type="search"
        placeholder="Name, dish or street"
        defaultValue={filters.q ?? ""}
        enterKeyHint="search"
        maxLength={100}
        className="col-span-2 lg:col-span-1"
      />
      <Select
        label="Cuisine"
        value={filters.cuisine ?? ""}
        onChange={(event) =>
          change({ cuisine: isCuisine(event.target.value) ? event.target.value : undefined })
        }
      >
        <option value="">Any cuisine</option>
        {cuisineOptions.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
      <Select
        label="District"
        value={filters.district ?? ""}
        onChange={(event) =>
          change({ district: isDistrict(event.target.value) ? event.target.value : undefined })
        }
      >
        <option value="">Any district</option>
        {districtOptions.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
      <Select
        label="Price"
        value={filters.price ?? ""}
        onChange={(event) =>
          change({ price: event.target.value ? Number(event.target.value) : undefined })
        }
      >
        <option value="">Any price</option>
        {PRICE_LEVELS.map((level) => (
          <option key={level} value={level}>
            {priceSigns(level)} {priceWords(level)}
          </option>
        ))}
      </Select>
      <Button type="submit" variant="ghost" className="w-full lg:w-auto">
        Search
      </Button>
    </form>
  );
}
