import type { FormEvent, ReactElement, ReactNode } from "react";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { cx } from "@/lib/cx";

// Tailwind finds class names by reading the code, so each layout is written out in full.
const columns = {
  1: "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]",
  2: "lg:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))_auto]",
};

interface AdminFilterBarProps {
  /** What screen readers call the form, such as "Restaurants". */
  label: string;
  /** The search in use. */
  q: string | undefined;
  /** What the box looks in, as its placeholder, such as "Name or street". */
  placeholder: string;
  /** The words searched for, or undefined for no search. */
  onSearch: (q: string | undefined) => void;
  /** The filters beside the search: one or two. */
  choices: 1 | 2;
  children: ReactNode;
}

/**
 * The search and filters above an admin list, laid out as Browse's are. A choice applies at once;
 * the search applies when it's sent, with Enter or the button, so the list doesn't reload at every
 * letter. The box holds what's typed by itself, so its list gives the bar a new key when the search
 * in the address changes, such as after Back, and the box then shows the search in use.
 */
export function AdminFilterBar({
  label,
  q,
  placeholder,
  onSearch,
  choices,
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
      className={cx("grid grid-cols-2 items-end gap-x-6 gap-y-5", columns[choices])}
    >
      <Input
        label="Search"
        name="q"
        type="search"
        placeholder={placeholder}
        defaultValue={q ?? ""}
        enterKeyHint="search"
        maxLength={100}
        className="col-span-2 lg:col-span-1"
      />
      {children}
      {/* Beside a single filter on a phone, and under two. */}
      <Button
        type="submit"
        variant="ghost"
        className={cx("w-full lg:col-span-1 lg:w-auto", choices === 2 && "col-span-2")}
      >
        Search
      </Button>
    </form>
  );
}
