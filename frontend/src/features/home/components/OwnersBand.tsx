import type { ReactElement } from "react";
import { Link } from "react-router";

import { forRestaurants } from "@/components/site-links";
import { cx } from "@/lib/cx";

/**
 * The home page's invitation to restaurant owners. The page shows it to anyone signed out, as the
 * header shows For restaurants, and it leads to the same sign-up for restaurants.
 */
export function OwnersBand({
  heading: Heading = "h2",
  className,
}: {
  /** h2 on the page. /design shows it under its own headings. */
  heading?: "h2" | "h4";
  className?: string;
}): ReactElement {
  return (
    <section
      aria-labelledby="owners-title"
      className={cx(
        "flex flex-wrap items-center justify-between gap-6 rounded-feature bg-surface-blush p-8 md:p-10",
        className,
      )}
    >
      <div className="max-w-155">
        <Heading id="owners-title" className="font-grotesque text-heading font-bold">
          Run a restaurant in Yerevan?
        </Heading>
        <p className="mt-2 text-body leading-copy text-ink-secondary">
          Add your restaurant, set up its tables and opening hours, and manage every booking from
          one dashboard. No double bookings, ever.
        </p>
      </div>
      <Link
        to={forRestaurants.to}
        className="inline-flex min-h-12 items-center rounded-pill bg-ink px-6 text-body font-semibold text-on-dark transition-[background-color] duration-button hover:bg-fill-primary-hover"
      >
        List your restaurant
      </Link>
    </section>
  );
}
