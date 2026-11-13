import type { ReactElement, ReactNode } from "react";
import { Link } from "react-router";

import { LinkButton } from "@/components/Button";
import { ArrowLeftIcon, StarIcon } from "@/components/icons";
import { filtersToParams } from "@/features/restaurants/browseFilters";
import { OpeningHoursList } from "@/features/restaurants/components/OpeningHoursList";
import { BESIDE_COVER, RestaurantPhotos } from "@/features/restaurants/components/RestaurantPhotos";
import { isShownWhole } from "@/features/restaurants/covers";
import { openState, openWords } from "@/features/restaurants/openingHours";
import {
  cuisineLine,
  DISTRICT_LABELS,
  priceSigns,
  priceWords,
} from "@/features/restaurants/labels";
import { RestaurantReviews } from "@/features/reviews/components/RestaurantReviews";
import type { ReviewListState } from "@/features/reviews/components/RestaurantReviews";
import { averageWords, reviewersWords } from "@/features/reviews/reviews";
import { cx } from "@/lib/cx";
import { photoUrl } from "@/lib/images";
import type { RestaurantDetail } from "@/types/api";

// The page uses h1 and h2. /design shows the page under its own headings, one level down from h3.
const HEADINGS = { 1: ["h1", "h2"], 4: ["h4", "h5"] } as const;

const sectionTitle = "font-grotesque text-subheading font-bold";

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

// A link inside a line of small print, such as a credit: underlined, as every link on the page is.
const inlineLink =
  "underline decoration-line-control underline-offset-2 transition-[text-decoration-color] duration-button hover:decoration-ink";

const COMMONS = "https://commons.wikimedia.org/";

type CreditedPhoto = RestaurantDetail["photos"][number] & { credit: string; creditUrl: string };

/**
 * Where a demo listing's photos come from, each linking to its source: what their licenses ask in
 * return for using them. Photos from Wikimedia Commons are listed together, each with its author
 * and license; a restaurant's own are credited to its site once, however many there are. They're
 * listed in the order their first photo appears.
 */
function PhotoCredits({ credited }: { credited: CreditedPhoto[] }): ReactElement {
  const groups: { key: string; photos: typeof credited }[] = [];
  for (const photo of credited) {
    const key = photo.creditUrl.startsWith(COMMONS)
      ? COMMONS
      : `${photo.credit} ${photo.creditUrl}`;
    const group = groups.find((one) => one.key === key);
    if (group) group.photos.push(photo);
    else groups.push({ key, photos: [photo] });
  }
  const link = (photo: (typeof credited)[number]): ReactElement => (
    <a href={photo.creditUrl} {...newTab} className={inlineLink}>
      {photo.credit}
      <NewTabNote />
    </a>
  );
  return (
    <p>
      {credited.length === 1 ? "Photo" : "Photos"}:{" "}
      {groups.map(({ key, photos: group }, index) => (
        <span key={key}>
          {index > 0 && "; "}
          {key === COMMONS ? (
            <>
              {group.map((photo, at) => (
                <span key={photo.url}>
                  {at > 0 && " · "}
                  {link(photo)}
                </span>
              ))}
              , via Wikimedia Commons
            </>
          ) : (
            group[0] && link(group[0])
          )}
        </span>
      ))}
    </p>
  );
}

/**
 * The small print under the cover: who took its photos, then, for a demo listing in OpenStreetMap
 * (9.7), where its details come from. Both are what licenses ask: OpenStreetMap's for its data,
 * and Geoapify's free plan for its own credit beside what its API returned. Owners' own photos and
 * details need no credit, so a restaurant with neither has none.
 */
function Credits({
  photos,
  osmUrl,
  className,
}: Pick<RestaurantDetail, "photos" | "osmUrl"> & { className?: string }): ReactElement | null {
  const credited = photos.filter(
    (photo): photo is CreditedPhoto => photo.credit !== null && photo.creditUrl !== null,
  );
  if (credited.length === 0 && !osmUrl) return null;
  return (
    <div className={cx("flex flex-col gap-0.5 text-caption text-ink-muted", className)}>
      {credited.length > 0 && <PhotoCredits credited={credited} />}
      {osmUrl && (
        <p>
          Details ©{" "}
          <a href="https://www.openstreetmap.org/copyright" {...newTab} className={inlineLink}>
            OpenStreetMap contributors
            <NewTabNote />
          </a>
          , through{" "}
          <a href="https://www.geoapify.com/" {...newTab} className={inlineLink}>
            Geoapify
            <NewTabNote />
          </a>
        </p>
      )}
    </div>
  );
}

interface RestaurantDetailsProps {
  restaurant: RestaurantDetail;
  /** Today's weekday in Yerevan, marked in the opening hours. */
  today?: number;
  /** The time in Yerevan, HH:MM, to say whether it's open now. With no time, that isn't said. */
  now?: string;
  /** 1 on the page. /design sets 4, under its own headings. */
  headingLevel?: 1 | 4;
  /** The booking widget, in its own panel beside the details, or after the name on a phone. */
  booking?: ReactNode;
  /** Saving it to favorites, beside its name (SaveRestaurant). */
  save?: ReactNode;
  /** The map of its street (RestaurantMap). Without it, the address and its link stand alone. */
  map?: ReactNode;
  /** The reviews themselves. Without them, the Reviews section shows only the rating. */
  reviews?: ReviewListState;
  /** For /design: its cover shown whole, as covers.ts shows the photos it names. */
  coverWhole?: boolean;
  className?: string;
}

const crumb =
  "inline-flex min-h-touch items-center underline decoration-line-underline underline-offset-4 transition-[color,text-decoration-color] duration-button hover:text-ink hover:decoration-current md:min-h-0";

/** Where the restaurant sits: all restaurants, its district on Browse, then the restaurant itself. */
function Breadcrumb({
  district,
  name,
  className,
}: Pick<RestaurantDetail, "district" | "name"> & { className?: string }): ReactElement {
  const inDistrict = filtersToParams({ district, page: 1 }).toString();
  return (
    <nav aria-label="Breadcrumb" className={className}>
      {/* The slashes are drawn, not read: screen readers hear a list of three places. */}
      <ol className="flex flex-wrap items-center gap-x-2 text-ui text-ink-secondary">
        <li>
          <Link to="/restaurants" className={crumb}>
            Restaurants
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li>
          <Link to={{ pathname: "/restaurants", search: `?${inDistrict}` }} className={crumb}>
            {DISTRICT_LABELS[district]}
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li aria-current="page" className="min-w-0 truncate">
          {name}
        </li>
      </ol>
    </nav>
  );
}

const reviewsWords = (count: number): string => (count === 1 ? "1 review" : `${count} reviews`);

/**
 * A restaurant's page, as the export sets it. The photos lead, then the name, large, with Save, and
 * a line of what it is: its rating, cuisine, price, address and whether it's open now. Beside them
 * from 1024px, in a white panel that stays in view, is booking a table: on a phone it comes straight
 * after the name, because booking is what the page is for. There, the photo runs from edge to edge
 * and the page rises over its foot as a white sheet, as in the export's phone screen. The
 * description, opening hours, map, contact and reviews follow. With no photo, the menu cover
 * stands in, in the same tone as its card on Browse.
 */
export function RestaurantDetails({
  restaurant,
  today,
  now,
  headingLevel = 1,
  booking,
  save,
  map,
  reviews,
  coverWhole,
  className,
}: RestaurantDetailsProps): ReactElement {
  const [Title, Section] = HEADINGS[headingLevel];
  const { slug, name, description, cuisines, district, priceLevel, coverPhotoUrl } = restaurant;
  const others = restaurant.photos.map(({ url }) => url).filter((url) => url !== coverPhotoUrl);
  const beside = others.slice(0, BESIDE_COVER);
  const later = others.slice(BESIDE_COVER);
  const whole = coverWhole ?? (coverPhotoUrl !== null && isShownWhole(coverPhotoUrl));
  const open =
    today !== undefined && now !== undefined
      ? openState(restaurant.openingHours, today, now)
      : null;
  // On a phone the photos beside the cover wait here, with any others, under the details.
  const morePhotos = [
    ...beside.map((url) => ({ url, phoneOnly: true })),
    ...later.map((url) => ({ url, phoneOnly: false })),
  ];
  const credits = { photos: restaurant.photos, osmUrl: restaurant.osmUrl };

  return (
    <article className={className}>
      <Breadcrumb district={district} name={name} className="max-lg:hidden" />
      <div className="relative lg:mt-6">
        <RestaurantPhotos
          name={name}
          slug={slug}
          cover={coverPhotoUrl}
          beside={beside}
          whole={whole}
        />
        {/* On a phone the breadcrumb gives way to a way back, on the photo, as in the export. */}
        <Link
          to="/restaurants"
          aria-label="All restaurants"
          className="absolute top-4 left-0 grid size-11 place-items-center rounded-pill bg-surface-raised text-ink shadow-tab lg:hidden"
        >
          <ArrowLeftIcon width="20" height="20" />
        </Link>
      </div>

      {/* From 1024px, the booking panel spans both rows beside the details. The second row takes
          any height the panel needs beyond the first, so the details follow the name closely. On a
          phone this is the white sheet, rising 60px over the photo, with a handle at its top. */}
      <div className="grid gap-x-10 gap-y-10 max-lg:relative max-lg:-mx-gutter-sm max-lg:-mt-15 max-lg:rounded-t-feature max-lg:bg-surface-raised max-lg:px-gutter-sm max-lg:pt-3 max-lg:pb-10 lg:mt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,27.5rem)] lg:grid-rows-[auto_1fr]">
        {/* A div, not <header>: tests would count a <header> as a second page banner. */}
        <div className="lg:col-start-1 lg:row-start-1">
          <span
            aria-hidden="true"
            className="mx-auto mb-5 block h-1 w-10 rounded-pill bg-line-strong lg:hidden"
          />
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <Title className="min-w-0 font-grotesque text-display font-bold text-balance break-words">
              {name}
            </Title>
            {save}
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-input text-ink-secondary">
            {restaurant.reviewCount > 0 && (
              <span className="flex items-center gap-1 font-semibold text-ink">
                <StarIcon width="16" height="16" className="text-star" />
                <span className="sr-only">Rated </span>
                {averageWords(restaurant.avgRating)}
                <span className="sr-only"> {reviewersWords(restaurant.reviewCount)}</span>
                <span aria-hidden="true" className="font-normal text-ink-secondary">
                  ({reviewsWords(restaurant.reviewCount)})
                </span>
              </span>
            )}
            {/* A demo listing no source gives a cuisine for (9.7) has none to show. */}
            {cuisines.length > 0 && <span>{cuisineLine(cuisines)}</span>}
            {/* A demo listing has no price: no source gives one. */}
            {priceLevel !== null && (
              <span>
                <span aria-hidden="true">{priceSigns(priceLevel)}</span>
                <span className="sr-only">{priceWords(priceLevel)}</span>
              </span>
            )}
            <span>{restaurant.address}</span>
            {open && (
              <span
                className={cx(
                  "font-semibold",
                  open.kind === "open" ? "text-success-strong" : "text-ink-secondary",
                )}
              >
                {openWords(open)}
              </span>
            )}
          </p>
          {/* Small print the licenses ask for, under the name, where the sheet leaves room. */}
          <Credits {...credits} className="mt-3" />
        </div>

        {booking && (
          <section className="self-start lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:rounded-sheet lg:border lg:border-line lg:bg-surface-raised lg:p-6 lg:shadow-panel max-lg:border-y max-lg:border-line max-lg:py-8">
            <Section className={sectionTitle}>Reserve a table</Section>
            {/* A demo listing's tables are samples (9.7): its bookings never reach the restaurant. */}
            {restaurant.isDemoListing && (
              <p className="mt-2 text-ui text-pretty text-ink-secondary">
                This is a test booking. The restaurant won’t receive it.
              </p>
            )}
            <div className="mt-5">{booking}</div>
          </section>
        )}

        <div className="flex flex-col gap-10 lg:col-start-1 lg:row-start-2">
          {description && (
            <section>
              <Section className={sectionTitle}>About</Section>
              <p className="mt-3 max-w-170 text-body leading-[1.65] text-pretty text-ink-body">
                {description}
              </p>
            </section>
          )}

          <div className="grid gap-10 md:grid-cols-2 md:gap-6">
            <div className="flex flex-col gap-10">
              <section>
                <Section className={sectionTitle}>Opening hours</Section>
                <div className="mt-3">
                  <OpeningHoursList hours={restaurant.openingHours} today={today} />
                </div>
              </section>

              {(restaurant.phone || restaurant.website) && (
                <section>
                  <Section className={sectionTitle}>Contact</Section>
                  <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-6 gap-y-1 text-input">
                    {restaurant.phone && (
                      <>
                        <dt className="text-ink-secondary">Phone</dt>
                        <dd>
                          <LinkButton
                            variant="link"
                            to={`tel:${restaurant.phone}`}
                            className="text-input"
                          >
                            {restaurant.phone}
                          </LinkButton>
                        </dd>
                      </>
                    )}
                    {restaurant.website && (
                      <>
                        <dt className="text-ink-secondary">Website</dt>
                        <dd className="min-w-0">
                          <LinkButton
                            variant="link"
                            to={restaurant.website}
                            {...newTab}
                            className="text-input"
                          >
                            {websiteName(restaurant.website)}
                            <NewTabNote />
                          </LinkButton>
                        </dd>
                      </>
                    )}
                  </dl>
                </section>
              )}
            </div>

            <section>
              <Section className={sectionTitle}>Location</Section>
              <div className="mt-3">{map}</div>
              {/* Shown under the map only when there's no map: the line under the name has it. */}
              {!map && (
                <address className="mt-3 text-input not-italic">{restaurant.address}</address>
              )}
              <LinkButton variant="link" to={restaurant.mapsUrl} {...newTab} className="mt-2">
                Get directions
                <NewTabNote />
              </LinkButton>
            </section>
          </div>

          {morePhotos.length > 0 && (
            <ul
              aria-label="More photos"
              className={cx(
                "grid grid-cols-2 gap-2 sm:grid-cols-3",
                later.length === 0 && "lg:hidden",
              )}
            >
              {morePhotos.map(({ url, phoneOnly }) => (
                <li key={url} className={phoneOnly ? "lg:hidden" : undefined}>
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

          {/* Every restaurant has its Reviews, a demo listing too, now that it can be booked (9.7). */}
          <section>
            <Section className={sectionTitle}>Reviews</Section>
            <div className="mt-5">
              <RestaurantReviews
                avgRating={restaurant.avgRating}
                reviewCount={restaurant.reviewCount}
                list={reviews}
              />
            </div>
          </section>
        </div>
      </div>
    </article>
  );
}
