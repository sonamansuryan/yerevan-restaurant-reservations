import { useId } from "react";
import type { ReactElement } from "react";
import { Link } from "react-router";

import { LinkButton } from "@/components/Button";
import { cuisineLine, DISTRICT_LABELS } from "@/features/restaurants/labels";
import { toneFor } from "@/features/restaurants/tones";
import { cx } from "@/lib/cx";
import { photoUrl } from "@/lib/images";
import type { ListResponse, RestaurantSummary } from "@/types/api";

/** The guest's first saved restaurants, once they've come. */
export interface SavedPreviewState {
  data: ListResponse<RestaurantSummary> | undefined;
  failed: boolean;
}

/** How many saved restaurants the side shows. The rest are on My favorites. */
const SHOWN = 4;

/**
 * The guest's saved restaurants beside their bookings, as the export has them: a white panel with
 * how many there are, then the first four, each with a small photo, its name and what it serves.
 * More than four, and the rest are a link away. Nothing is said while they load: the bookings are
 * the page's work, and this panel only waits for its list.
 */
export function SavedRestaurants({
  saved,
  headingLevel = 2,
  className,
}: {
  saved: SavedPreviewState;
  /** 2 on the page, 4 inside /design. */
  headingLevel?: 2 | 4;
  className?: string;
}): ReactElement {
  const titleId = useId();
  const Heading = headingLevel === 2 ? "h2" : "h4";
  const total = saved.data?.meta.total;

  let body: ReactElement | null = null;
  if (saved.failed) {
    body = <p className="text-ui text-ink-secondary">We couldn’t load your saved restaurants.</p>;
  } else if (saved.data && saved.data.data.length === 0) {
    body = (
      <p className="text-ui text-ink-secondary">
        Save a restaurant from its page, and it shows here.
      </p>
    );
  } else if (saved.data) {
    body = (
      <ul className="flex flex-col gap-3">
        {saved.data.data.slice(0, SHOWN).map((restaurant) => (
          <li key={restaurant.slug}>
            <Link
              to={`/restaurants/${restaurant.slug}`}
              className="group flex items-center gap-3 rounded-card"
            >
              {restaurant.coverPhotoUrl ? (
                <img
                  src={photoUrl(restaurant.coverPhotoUrl, 160)}
                  alt=""
                  loading="lazy"
                  className="size-13 flex-none rounded-card object-cover"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className={cx("size-13 flex-none rounded-card", toneFor(restaurant.slug))}
                />
              )}
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-input font-semibold break-words underline decoration-transparent underline-offset-4 transition-[text-decoration-color] duration-button group-hover:decoration-current">
                  {restaurant.name}
                </span>{" "}
                <span className="text-meta text-ink-secondary">
                  {[cuisineLine(restaurant.cuisines), DISTRICT_LABELS[restaurant.district]]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <aside
      aria-labelledby={titleId}
      className={cx(
        "flex flex-col gap-4 rounded-band border border-line bg-surface-raised p-5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <Heading id={titleId} className="font-grotesque text-title-xs font-bold">
          Saved restaurants
        </Heading>
        {total !== undefined && <span className="text-ui text-ink-secondary">{total}</span>}
      </div>
      {body}
      {total !== undefined && total > SHOWN && (
        <LinkButton variant="link" to="/favorites" className="self-start">
          See all {total}
        </LinkButton>
      )}
    </aside>
  );
}
