import type { ReactElement, ReactNode } from "react";
import { Link } from "react-router";

import { MenuCover } from "@/features/restaurants/components/MenuCover";
import { isShownWhole } from "@/features/restaurants/covers";
import {
  cuisineLine,
  DISTRICT_LABELS,
  priceSigns,
  priceWords,
} from "@/features/restaurants/labels";
import { averageWords, reviewersWords } from "@/features/reviews/reviews";
import { cx } from "@/lib/cx";
import { photoUrl } from "@/lib/images";
import type { RestaurantSummary } from "@/types/api";

interface RestaurantCardProps {
  restaurant: RestaurantSummary;
  /** The name's heading level, one below the heading the card sits under. */
  heading?: "h2" | "h3" | "h4";
  /** Something to do with the restaurant, under its details, above the card's one link. */
  action?: ReactNode;
  /** For /design: its cover shown whole, as covers.ts shows the photos it names. */
  coverWhole?: boolean;
}

/**
 * A restaurant in a list: its photo, or a menu cover when it has none, then its name and what it
 * serves, where and for how much, and how guests rate it once some have. The name is the card's one link, stretched over the whole card,
 * so the card is a single stop for the keyboard and screen readers hear only the name. A demo
 * listing (9.7) has no price, which no source gives. A cover a crop would spoil (covers.ts) is
 * shown whole, on the paper tint, rather than cropped to fill the card.
 */
export function RestaurantCard({
  restaurant,
  heading: Heading = "h2",
  action,
  coverWhole,
}: RestaurantCardProps): ReactElement {
  const {
    slug,
    name,
    description,
    cuisines,
    district,
    priceLevel,
    avgRating,
    reviewCount,
    coverPhotoUrl,
  } = restaurant;
  const districtName = DISTRICT_LABELS[district];
  const whole = coverWhole ?? (coverPhotoUrl !== null && isShownWhole(coverPhotoUrl));

  return (
    <article className="group relative flex flex-col gap-4">
      <div className={cx("aspect-4/3 overflow-hidden rounded-media", whole && "bg-surface-tinted")}>
        {coverPhotoUrl ? (
          // Decorative here: the name and details follow it.
          <img
            src={photoUrl(coverPhotoUrl, 800)}
            alt=""
            loading="lazy"
            className={cx("size-full", whole ? "object-contain" : "object-cover")}
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
          {priceLevel !== null && (
            <>
              {" · "}
              <span aria-hidden="true">{priceSigns(priceLevel)}</span>
              <span className="sr-only">{priceWords(priceLevel)}</span>
            </>
          )}
        </p>
        {reviewCount > 0 && (
          <p className="text-meta text-ink-muted">
            Rated <span className="font-medium text-ink">{averageWords(avgRating)}</span>{" "}
            {reviewersWords(reviewCount)}
          </p>
        )}
        {description && (
          <p className="line-clamp-2 text-ui text-pretty text-ink-secondary">{description}</p>
        )}
        {/* Raised above the name's link, which is stretched over the whole card. */}
        {action && <div className="relative z-10 self-start">{action}</div>}
      </div>
    </article>
  );
}
