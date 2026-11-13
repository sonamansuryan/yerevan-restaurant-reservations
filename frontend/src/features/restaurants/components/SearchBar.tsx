import type { ReactElement, ReactNode } from "react";

import { ChevronDownIcon, SearchIcon } from "@/components/icons";
import { GUEST_COUNTS, guestsLabel } from "@/features/booking/booking";
import { SEARCH_TIMES, searchDays } from "@/features/restaurants/tableSearch";
import type { TableQuery } from "@/features/restaurants/tableSearch";
import { cx } from "@/lib/cx";
import { formatShortDay } from "@/lib/time";

interface SearchBarProps {
  /** The words above the search box, such as "Restaurant, dish or street". */
  label: string;
  placeholder: string;
  /** The search already in use, on Browse. */
  defaultText?: string;
  /** The table looked for, which the day, time and party start at. */
  query: TableQuery;
  /** Today in Yerevan, the first day to choose. */
  today: string;
  /** The button's words: "Find a table" on the home page, "Search" on Browse. */
  button: string;
  className?: string;
}

// One part of the bar: its name in small bold letters, then what's typed or chosen. The ring goes
// around the whole part, not just the words, which have no box of their own.
const part =
  "relative flex min-w-0 flex-col gap-0.5 rounded-hero px-4 py-2.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent";
const partName = "text-caption font-semibold text-ink-secondary";
// 16px, because iPhones zoom the whole page when a smaller field gets focus.
const partValue = "h-6 w-full min-w-0 bg-transparent text-body text-ink focus-visible:outline-none";

/** A choice in the bar: a real <select>, so keyboards and phones' own pickers work, under an arrow. */
function Choice({
  name,
  label,
  defaultValue,
  className,
  children,
}: {
  name: string;
  label: string;
  defaultValue: string;
  className?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <label className={cx(part, className)}>
      <span className={partName}>{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className={cx(partValue, "cursor-pointer appearance-none pr-6")}
      >
        {children}
      </select>
      <ChevronDownIcon
        width="16"
        height="16"
        strokeWidth="1.8"
        className="pointer-events-none absolute right-3 bottom-3.5 text-ink-secondary"
      />
    </label>
  );
}

/**
 * The guest pages' search, as the export has it: one white bar holding what to look for, then the
 * day, the time and the party, and a wine button. The page wraps it in its own form and decides what
 * a search does; the fields are named q, date, time and guests, as Browse's address calls them.
 * On a phone the parts stack, the time and party side by side, with the button as wide as the bar.
 */
export function SearchBar({
  label,
  placeholder,
  defaultText,
  query,
  today,
  button,
  className,
}: SearchBarProps): ReactElement {
  return (
    <div
      // On the home page's dark band every focus ring is light. The bar is white, so wine comes back.
      className={cx(
        "grid grid-cols-2 gap-1 rounded-sheet bg-surface-raised p-2 text-ink [--focus-ring:var(--color-accent)] lg:flex",
        className,
      )}
    >
      <label className={cx(part, "col-span-2 lg:flex-[2_1_16rem]")}>
        <span className={partName}>{label}</span>
        <input
          name="q"
          type="search"
          placeholder={placeholder}
          defaultValue={defaultText}
          enterKeyHint="search"
          maxLength={100}
          className={partValue}
        />
      </label>
      {/* The lines between the parts: across on a phone, down the bar from 1024px. */}
      <Choice
        name="date"
        label="Date"
        defaultValue={query.date}
        className="col-span-2 rounded-none border-t border-line-divider lg:flex-[1_1_9rem] lg:border-t-0 lg:border-l"
      >
        {searchDays(today).map((day) => (
          <option key={day} value={day}>
            {formatShortDay(day, today)}
          </option>
        ))}
      </Choice>
      <Choice
        name="time"
        label="Time"
        defaultValue={query.time}
        className="rounded-none border-t border-line-divider lg:flex-[1_1_7rem] lg:border-t-0 lg:border-l"
      >
        {SEARCH_TIMES.map((time) => (
          <option key={time} value={time}>
            {time}
          </option>
        ))}
      </Choice>
      <Choice
        name="guests"
        label="Guests"
        defaultValue={String(query.guests)}
        className="rounded-none border-t border-l border-line-divider lg:flex-[1_1_7rem] lg:border-t-0"
      >
        {GUEST_COUNTS.map((count) => (
          <option key={count} value={count}>
            {guestsLabel(count)}
          </option>
        ))}
      </Choice>
      <button
        type="submit"
        className="col-span-2 mt-1 inline-flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-hero bg-accent px-7 text-body font-semibold text-on-accent transition-[background-color] duration-button hover:bg-accent-hover lg:mt-0"
      >
        <SearchIcon width={18} height={18} />
        {button}
      </button>
    </div>
  );
}
