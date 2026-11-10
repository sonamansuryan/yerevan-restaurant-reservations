import type { FormEvent, ReactElement } from "react";
import { useNavigate } from "react-router";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { filtersToParams } from "@/features/restaurants/browseFilters";
import { cx } from "@/lib/cx";

/**
 * The home page's search. It takes the words to Browse, as ?q=, where the list is filtered and the
 * search box there shows them. The address is built by Browse's own rules, so an empty search
 * simply opens Browse.
 */
export function RestaurantSearch({ className }: { className?: string }): ReactElement {
  const navigate = useNavigate();

  function search(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const text = new FormData(event.currentTarget).get("q");
    const q = typeof text === "string" ? text.trim().slice(0, 100) : "";
    const query = filtersToParams({ ...(q ? { q } : {}), page: 1 }).toString();
    void navigate({ pathname: "/restaurants", search: query ? `?${query}` : "" });
  }

  return (
    <form
      role="search"
      aria-label="Restaurants"
      onSubmit={search}
      className={cx("flex items-end gap-4", className)}
    >
      <Input
        label="Search restaurants"
        name="q"
        type="search"
        placeholder="Name, dish or street"
        enterKeyHint="search"
        maxLength={100}
        className="min-w-0 flex-1"
      />
      <Button type="submit">Search</Button>
    </form>
  );
}
