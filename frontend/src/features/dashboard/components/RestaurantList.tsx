import type { ReactElement } from "react";
import { Link } from "react-router";

import { ArrowRightIcon } from "@/components/icons";
import { PublishedBadge } from "@/features/dashboard/components/PublishedBadge";
import { DISTRICT_LABELS, cuisineLine } from "@/features/restaurants/labels";
import type { OwnerRestaurant } from "@/types/api";

/**
 * The owner's restaurants, a white card each: the name in bold, where it is and what it serves,
 * and whether guests can see it. Each whole card opens that restaurant's dashboard.
 */
export function RestaurantList({ restaurants }: { restaurants: OwnerRestaurant[] }): ReactElement {
  return (
    <ul className="flex flex-col gap-3">
      {restaurants.map((restaurant) => (
        <li key={restaurant.id}>
          <Link
            to={`/dashboard/${restaurant.id}`}
            className="group flex min-h-touch items-center gap-4 rounded-band border border-line bg-surface-raised p-4 transition-[border-color] duration-button hover:border-ink sm:gap-6 sm:p-5"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-lead font-semibold break-words">{restaurant.name}</span>
              <span className="mt-0.5 block text-meta text-ink-secondary">
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
