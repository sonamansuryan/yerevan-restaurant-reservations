import type { ReactElement, ReactNode } from "react";

import { LinkButton } from "@/components/Button";
import { OpeningHoursList } from "@/features/restaurants/components/OpeningHoursList";
import {
  cuisineLine,
  DISTRICT_LABELS,
  priceSigns,
  priceWords,
} from "@/features/restaurants/labels";
import { toneFor } from "@/features/restaurants/tones";
import { cx } from "@/lib/cx";
import { photoUrl } from "@/lib/images";
import type { RestaurantDetail } from "@/types/api";

// The page uses h1 and h2. /design shows the page under its own headings, one level down from h3.
const HEADINGS = { 1: ["h1", "h2"], 4: ["h4", "h5"] } as const;

const sectionTitle = "border-t border-line pt-5 font-display text-title";

/** "seghan.am" instead of "https://www.seghan.am/", or the address as it is if it can't be read. */
function websiteName(website: string): string {
  try {
    return new URL(website).hostname.replace(/^www\./, "");
  } catch {
    return website;
  }
}

/**
 * Opens in a new tab, which a screen reader is told, because people otherwise lose their place.
 * The note starts with a comma, not a space: a link lays out its words as a flex row, which drops a
 * space at the edge of a span.
 */
const newTab = { target: "_blank", rel: "noopener noreferrer" } as const;
const NewTabNote = (): ReactElement => <span className="sr-only">, opens in a new tab</span>;

interface RestaurantDetailsProps {
  restaurant: RestaurantDetail;
  /** Today's weekday in Yerevan, marked in the opening hours. */
  today?: number;
  /** 1 on the page. /design sets 4, under its own headings. */
  headingLevel?: 1 | 4;
  /** The booking widget, first among the practical details. */
  booking?: ReactNode;
  className?: string;
}

/**
 * A restaurant's page. With no photo, its cover is the title itself: the name in serif on its tone,
 * like the cover of a menu, the same tone as its card on Browse. With a photo, the photo leads and
 * the title follows. Below, the description and reviews sit beside the practical details. On a
 * phone everything stacks, the address and hours coming before the reviews.
 */
export function RestaurantDetails({
  restaurant,
  today,
  headingLevel = 1,
  booking,
  className,
}: RestaurantDetailsProps): ReactElement {
  const [Title, Section] = HEADINGS[headingLevel];
  const { slug, name, description, cuisines, district, priceLevel, coverPhotoUrl } = restaurant;
  const morePhotos = restaurant.photos.filter(({ url }) => url !== coverPhotoUrl).slice(0, 6);

  const facts = (
    <>
      {DISTRICT_LABELS[district]} · <span aria-hidden="true">{priceSigns(priceLevel)}</span>
      <span className="sr-only">{priceWords(priceLevel)}</span>
    </>
  );

  return (
    <article className={className}>
      {/* A div, not <header>: tests would count a <header> as a second page banner. */}
      <div>
        {coverPhotoUrl ? (
          <>
            {/* Decorative until owners can describe their photos: the name follows at once. */}
            <img
              src={photoUrl(coverPhotoUrl, 1600)}
              srcSet={`${photoUrl(coverPhotoUrl, 800)} 800w, ${photoUrl(coverPhotoUrl, 1600)} 1600w`}
              sizes="(min-width: 1280px) 1216px, 100vw"
              alt=""
              className="aspect-3/2 w-full rounded-hero object-cover lg:aspect-21/9"
            />
            <div className="mt-8">
              <p className="text-eyebrow text-ink-muted uppercase">{facts}</p>
              <Title className="mt-3 font-display text-hero text-balance">{name}</Title>
              <p className="mt-3 text-lead text-ink-secondary">{cuisineLine(cuisines)}</p>
            </div>
          </>
        ) : (
          <div
            className={cx(
              "flex min-h-80 flex-col items-center justify-center rounded-hero px-6 py-16 text-center lg:min-h-104",
              toneFor(slug),
            )}
          >
            <p className="text-eyebrow text-on-dark-secondary uppercase">{facts}</p>
            <Title className="mt-4 max-w-full font-display text-hero text-balance break-words text-on-dark">
              {name}
            </Title>
            <p className="mt-4 text-lead text-on-dark-secondary">{cuisineLine(cuisines)}</p>
          </div>
        )}
      </div>

      {/* The first row fits the description, so the reviews follow it closely while the details
          beside them run on: the right column spans both rows and gives its extra height to the second. */}
      <div className="mt-12 grid gap-x-16 gap-y-12 lg:mt-section-sm lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:grid-rows-[auto_1fr]">
        {description && (
          <p className="max-w-160 text-lead text-pretty lg:col-start-1 lg:row-start-1">
            {description}
          </p>
        )}

        <div className="flex flex-col gap-10 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          {booking && (
            <section>
              <Section className={sectionTitle}>Book a table</Section>
              <div className="mt-5">{booking}</div>
            </section>
          )}

          <section>
            <Section className={sectionTitle}>Address</Section>
            <address className="mt-3 text-body not-italic">{restaurant.address}</address>
            <LinkButton variant="link" to={restaurant.mapsUrl} {...newTab} className="mt-1">
              Open in Google Maps
              <NewTabNote />
            </LinkButton>
          </section>

          <section>
            <Section className={sectionTitle}>Opening hours</Section>
            <div className="mt-2">
              <OpeningHoursList hours={restaurant.openingHours} today={today} />
            </div>
          </section>

          {(restaurant.phone || restaurant.website) && (
            <section>
              <Section className={sectionTitle}>Contact</Section>
              <dl className="mt-2 text-ui">
                {restaurant.phone && (
                  <div className="flex items-baseline gap-2 border-b border-line py-1">
                    <dt className="flex flex-1 items-baseline gap-2 text-ink-secondary">
                      Phone
                      <span aria-hidden="true" className="menu-leader" />
                    </dt>
                    <dd>
                      <LinkButton variant="link" to={`tel:${restaurant.phone}`}>
                        {restaurant.phone}
                      </LinkButton>
                    </dd>
                  </div>
                )}
                {restaurant.website && (
                  <div className="flex items-baseline gap-2 border-b border-line py-1">
                    <dt className="flex flex-1 items-baseline gap-2 text-ink-secondary">
                      Website
                      <span aria-hidden="true" className="menu-leader" />
                    </dt>
                    <dd>
                      <LinkButton variant="link" to={restaurant.website} {...newTab}>
                        {websiteName(restaurant.website)}
                        <NewTabNote />
                      </LinkButton>
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          )}
        </div>

        <div className="flex flex-col gap-12 lg:col-start-1 lg:row-start-2">
          {morePhotos.length > 0 && (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {morePhotos.map(({ url }) => (
                <li key={url}>
                  <img
                    src={photoUrl(url, 600)}
                    alt=""
                    loading="lazy"
                    className="aspect-square w-full rounded-media object-cover"
                  />
                </li>
              ))}
            </ul>
          )}

          <section>
            <Section className={sectionTitle}>Reviews</Section>
            {restaurant.reviewCount === 0 ? (
              <p className="mt-3 text-ui text-ink-secondary">
                No reviews yet. Guests can leave one after their visit.
              </p>
            ) : (
              <p className="mt-3 text-ui text-ink-secondary">
                Rated{" "}
                <span className="font-medium text-ink">{restaurant.avgRating.toFixed(1)}</span> out
                of 5 by {restaurant.reviewCount} {restaurant.reviewCount === 1 ? "guest" : "guests"}
                .
              </p>
            )}
          </section>
        </div>
      </div>
    </article>
  );
}
