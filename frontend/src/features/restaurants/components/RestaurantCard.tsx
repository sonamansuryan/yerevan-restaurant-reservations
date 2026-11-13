import type { ReactElement, ReactNode } from "react";
import { Link } from "react-router";

import { StarIcon } from "@/components/icons";
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
  /** Whether its description shows. The home page leaves it out, to keep tonight's times close. */
  description?: boolean;
  /** Something under the details, above the card's one link: its free times. */
  footer?: ReactNode;
  /** Saving it, as a heart on the photo (RestaurantHeart), above the card's one link. */
  save?: ReactNode;
  /** For /design: its cover shown whole, as covers.ts shows the photos it names. */
  coverWhole?: boolean;
}

/**
 * A restaurant in a list, as the export's white card: its photo, 168px tall, or a menu cover when it
 * has none, with a heart to save it, then its name and rating once guests have rated it, what it
 * serves, where and for how much, a line about it, and its free times. Browse, the home page and
 * favorites all use it. The name is the card's one link,
 * stretched over the whole card, so the card is a single stop for the keyboard and screen readers
 * hear only the name. The footer sits above that link, so its own buttons can be pressed. A demo
 * listing (9.7) has no price, which no source gives. A cover a crop would spoil (covers.ts) is
 * shown whole, on the paper tint, rather than cropped to fill the card.
 */
export function RestaurantCard({
  restaurant,
  heading: Heading = "h2",
  description: showDescription = true,
  footer,
  save,
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
  const whole = coverWhole ?? (coverPhotoUrl !== null && isShownWhole(coverPhotoUrl));

  return (
    <article className="group relative flex flex-col rounded-band border border-line bg-surface-raised">
      <div
        className={cx("relative h-42 overflow-hidden rounded-t-band", whole && "bg-surface-tinted")}
      >
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
        {/* Raised above the name's link, which is stretched over the whole card. */}
        {save && <div className="absolute right-3 bottom-3 z-10">{save}</div>}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <Heading className="min-w-0 text-lead font-semibold break-words">
            <Link
              to={`/restaurants/${slug}`}
              className="underline decoration-transparent underline-offset-4 transition-[text-decoration-color] duration-button group-hover:decoration-line-underline after:absolute after:inset-0 after:rounded-band focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-accent"
            >
              {name}
            </Link>
          </Heading>
          {reviewCount > 0 && (
            <p className="flex shrink-0 items-center gap-1 text-ui font-semibold">
              <StarIcon width="14" height="14" className="text-star" />
              <span className="sr-only">Rated </span>
              {averageWords(avgRating)}
              <span className="sr-only"> {reviewersWords(reviewCount)}</span>
            </p>
          )}
        </div>
        <p className="text-ui text-ink-secondary">
          {[cuisineLine(cuisines), DISTRICT_LABELS[district]].filter(Boolean).join(" · ")}
          {priceLevel !== null && (
            <>
              {" · "}
              <span aria-hidden="true">{priceSigns(priceLevel)}</span>
              <span className="sr-only">{priceWords(priceLevel)}</span>
            </>
          )}
        </p>
        {showDescription && description && (
          <p className="line-clamp-2 text-ui text-pretty text-ink-secondary">{description}</p>
        )}
        {/* Raised above the name's link, which is stretched over the whole card. */}
        {footer && <div className="relative z-10 mt-auto self-start pt-1">{footer}</div>}
      </div>
    </article>
  );
}
