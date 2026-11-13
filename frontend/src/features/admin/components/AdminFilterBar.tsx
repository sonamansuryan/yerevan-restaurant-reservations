import type { FormEvent, ReactElement, ReactNode } from "react";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";

interface AdminFilterBarProps {
  /** What screen readers call the form, such as "Restaurants". */
  label: string;
  /** The search in use. */
  q: string | undefined;
  /** What the box looks in, as its placeholder, such as "Name or street". */
  placeholder: string;
  /** The words searched for, or undefined for no search. */
  onSearch: (q: string | undefined) => void;
  /** The filters beside the search, such as a Select. */
  children: ReactNode;
}

/**
 * The search and filters above an admin list, in one row on a wide screen: the search box with its
 * button, then the filters. On a phone they stack. A choice applies at once;
 * the search applies when it's sent, with Enter or the button, so the list doesn't reload at every
 * letter. The box holds what's typed by itself, so its list gives the bar a new key when the search
 * in the address changes, such as after Back, and the box then shows the search in use.
 */
export function AdminFilterBar({
  label,
  q,
  placeholder,
  onSearch,
  children,
}: AdminFilterBarProps): ReactElement {
  function search(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const text = new FormData(event.currentTarget).get("q");
    onSearch(typeof text === "string" && text.trim() ? text.trim() : undefined);
  }

  return (
    <form
      role="search"
      aria-label={label}
      onSubmit={search}
      className="flex flex-col gap-4 lg:flex-row lg:items-end"
    >
      <div className="flex min-w-0 items-end gap-2 lg:flex-1">
        <Input
          label="Search"
          name="q"
          type="search"
          placeholder={placeholder}
          defaultValue={q ?? ""}
          enterKeyHint="search"
          maxLength={100}
          className="min-w-0 flex-1"
        />
        <Button type="submit" variant="ghost">
          Search
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:flex lg:gap-4 lg:*:w-48">{children}</div>
    </form>
  );
}
