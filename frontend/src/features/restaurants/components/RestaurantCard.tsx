import type { ReactElement } from "react";
import { Link } from "react-router";

import { MenuCover } from "@/features/restaurants/components/MenuCover";
import {
  cuisineLine,
  DISTRICT_LABELS,
  priceSigns,
  priceWords,
} from "@/features/restaurants/labels";
import { photoUrl } from "@/lib/images";
import type { RestaurantSummary } from "@/types/api";

interface RestaurantCardProps {
  restaurant: RestaurantSummary;
  /** The name's heading level, one below the heading the card sits under. */
  heading?: "h2" | "h3" | "h4";
}

/**
 * A restaurant in a list: its photo, or a menu cover when it has none, then its name and what it
 * serves, where and for how much. The name is the card's one link, stretched over the whole card,
 * so the card is a single stop for the keyboard and screen readers hear only the name.
 */
export function RestaurantCard({
  restaurant,
  heading: Heading = "h2",
}: RestaurantCardProps): ReactElement {
  const { slug, name, description, cuisines, district, priceLevel, coverPhotoUrl } = restaurant;
  const districtName = DISTRICT_LABELS[district];

  return (
    <article className="group relative flex flex-col gap-4">
      <div className="aspect-4/3 overflow-hidden rounded-media">
        {coverPhotoUrl ? (
          // Decorative here: the name and details follow it.
          <img
            src={photoUrl(coverPhotoUrl, 800)}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <MenuCover name={name} slug={slug} className="size-full" />
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Heading className="font-display text-title-sm">
          <Link
            to={`/restaurants/${slug}`}
            className="underline decoration-transparent underline-offset-4 transition-[text-decoration-color] duration-button group-hover:decoration-line-underline after:absolute after:inset-0 after:rounded-media focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-accent"
          >
            {name}
          </Link>
        </Heading>
        <p className="text-meta text-ink-muted">
          {[cuisineLine(cuisines), districtName].filter(Boolean).join(" · ")}
          {" · "}
          <span aria-hidden="true">{priceSigns(priceLevel)}</span>
          <span className="sr-only">{priceWords(priceLevel)}</span>
        </p>
        {description && (
          <p className="line-clamp-2 text-ui text-pretty text-ink-secondary">{description}</p>
        )}
      </div>
    </article>
  );
}
