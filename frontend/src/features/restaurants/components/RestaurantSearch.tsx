import type { FormEvent, ReactElement } from "react";
import { useNavigate } from "react-router";

import { filtersToParams } from "@/features/restaurants/browseFilters";
import { SearchBar } from "@/features/restaurants/components/SearchBar";
import { readSearch } from "@/features/restaurants/tableSearch";
import type { TableQuery } from "@/features/restaurants/tableSearch";

interface RestaurantSearchProps {
  /** The table the search starts at: today, about 19:30, for two. */
  query: TableQuery;
  today: string;
  className?: string;
}

/**
 * The home page's search: the white bar on the dark band, with Find a table. It takes the words,
 * the day, the time and the party to Browse, where the list is filtered by the words and each
 * restaurant shows its free times nearest then. The address is built by Browse's own rules, so an
 * empty search simply opens Browse. The words match names, descriptions and addresses, so the
 * label promises no more than that.
 */
export function RestaurantSearch({ query, today, className }: RestaurantSearchProps): ReactElement {
  const navigate = useNavigate();

  function search(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const { q, date, time, guests } = readSearch(event.currentTarget);
    const params = filtersToParams({ q, date, time, guests, page: 1 }).toString();
    void navigate({ pathname: "/restaurants", search: params ? `?${params}` : "" });
  }

  return (
    <form role="search" aria-label="Find a table" onSubmit={search} className={className}>
      <SearchBar
        label="Restaurant, dish or street"
        placeholder="e.g. khorovats, Abovyan Street"
        query={query}
        today={today}
        button="Find a table"
      />
    </form>
  );
}
