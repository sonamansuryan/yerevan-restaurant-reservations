import type { ReactElement, ReactNode } from "react";

import { cx } from "@/lib/cx";

function BookRow({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div className={cx("flex items-baseline gap-2 border-b border-line py-3", className)}>
      {children}
    </div>
  );
}

/**
 * For a guest signing up: three rows of a reservation book, with the name being typed written into
 * the middle one as it's typed. It's only decoration, so screen readers skip it, and phones show
 * just the middle row. A long name is cut short rather than widening the row.
 */
export function GuestBookLines({ name }: { name: string }): ReactElement {
  return (
    <div aria-hidden="true" className="mt-10 max-w-105 text-meta text-ink-muted">
      <BookRow className="border-t max-lg:hidden">19:30 · Table 4 · 2 guests</BookRow>
      <BookRow className="text-accent max-lg:border-t">
        <span className="shrink-0">20:00 ·</span>
        <span className="min-w-0 truncate font-display text-title-xs">
          {name.trim() || "Your name"}
        </span>
        <span className="menu-leader" />
        <span className="shrink-0">in the book</span>
      </BookRow>
      <BookRow className="max-lg:hidden">20:30 · Table 7 · 4 guests</BookRow>
    </div>
  );
}

const restaurantLines = [
  ["Tables", "Seats and zones"],
  ["Opening hours", "Split shifts and late nights"],
  ["Bookings", "Accept, cancel, mark arrivals"],
] as const;

/** For a restaurant signing up: what the dashboard holds, set as lines on a menu. */
export function RestaurantLines(): ReactElement {
  return (
    <ul className="mt-10 max-w-105 border-t border-line">
      {restaurantLines.map(([label, note]) => (
        <li key={label} className="flex items-baseline gap-2 border-b border-line py-3">
          <span className="font-display text-title-xs">{label}</span>{" "}
          <span aria-hidden="true" className="menu-leader" />
          <span className="text-meta text-ink-muted">{note}</span>
        </li>
      ))}
    </ul>
  );
}
