import type { ReactElement } from "react";
import { Link } from "react-router";

import { ArrowRightIcon } from "@/components/icons";
import { PublishedBadge } from "@/features/dashboard/components/PublishedBadge";
import { DISTRICT_LABELS, cuisineLine } from "@/features/restaurants/labels";
import type { OwnerRestaurant } from "@/types/api";

/**
 * The owner's restaurants as lines in the book: the name in serif, where it is and what it serves,
 * and whether guests can see it. Each whole line opens that restaurant.
 */
export function RestaurantList({ restaurants }: { restaurants: OwnerRestaurant[] }): ReactElement {
  return (
    <ul className="border-t border-line">
      {restaurants.map((restaurant) => (
        <li key={restaurant.id} className="border-b border-line">
          <Link
            to={`/dashboard/${restaurant.id}`}
            className="group flex min-h-touch items-center gap-4 py-5 sm:gap-8"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-display text-title break-words underline decoration-transparent decoration-1 underline-offset-4 transition-[text-decoration-color] duration-button group-hover:decoration-ink">
                {restaurant.name}
              </span>
              <span className="mt-1 block text-meta text-ink-secondary">
                {DISTRICT_LABELS[restaurant.district]} · {cuisineLine(restaurant.cuisines)}
              </span>
            </span>
            <PublishedBadge
              isPublished={restaurant.isPublished}
              hiddenBySeghan={restaurant.hiddenBySeghan}
            />
            <ArrowRightIcon
              aria-hidden="true"
              width="16"
              height="16"
              strokeWidth="1.6"
              className="flex-none text-ink-muted transition-[translate,color] duration-button group-hover:translate-x-0.5 group-hover:text-ink"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
