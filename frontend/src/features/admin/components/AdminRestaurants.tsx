import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import type { To } from "react-router";

import { Button, LinkButton } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import {
  RESTAURANT_SHOWS,
  SHOW_CHOICES,
  isFiltered,
  oneOf,
  restaurantsWords,
  visibilityWords,
} from "@/features/admin/admin";
import type { AdminRestaurantFilters } from "@/features/admin/admin";
import { AdminFilterBar } from "@/features/admin/components/AdminFilterBar";
import { AdminListBody } from "@/features/admin/components/AdminListBody";
import type { AdminListState, AdminListWords } from "@/features/admin/components/AdminListBody";
import { PublishedBadge } from "@/features/dashboard/components/PublishedBadge";
import { bookingsWords } from "@/features/reservations/reservations";
import { DISTRICT_LABELS } from "@/features/restaurants/labels";
import type { ApiError } from "@/lib/api";
import { cx } from "@/lib/cx";
import { formatDayHeading, yerevanToday } from "@/lib/time";
import type { AdminRestaurant } from "@/types/api";

const words: AdminListWords = {
  label: "Restaurants",
  loading: "Loading the restaurants",
  what: "the restaurants",
  count: restaurantsWords,
  none: {
    title: "No restaurants yet",
    description: "Restaurants appear here as soon as their owners add them.",
  },
  noMatch: {
    title: "No restaurants match",
    description: "Try a different search, or show every restaurant.",
  },
};

interface RestaurantLineProps {
  restaurant: AdminRestaurant;
  today: string;
  /** True while its change is being sent. */
  changing: boolean;
  onHide: (restaurant: AdminRestaurant) => void;
  onShow: (restaurant: AdminRestaurant) => void;
}

function RestaurantLine({
  restaurant,
  today,
  changing,
  onHide,
  onShow,
}: RestaurantLineProps): ReactElement {
  const { name, slug, district, owner, isPublished, hiddenAt, isDemoListing, reservations } =
    restaurant;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 gap-y-1 border-b border-line py-4">
      <div className="min-w-0">
        <p className="font-display text-title-xs break-words">{name}</p>
        <p className="mt-0.5 text-meta break-words text-ink-secondary">
          {DISTRICT_LABELS[district]} · {owner.name} · {owner.email}
        </p>
        <p className="text-meta text-ink-secondary">
          {bookingsWords(reservations)}
          {/* A real restaurant listed from public data (9.7), which nobody can book. */}
          {isDemoListing && " · Demo listing"}
          {/* The day in Yerevan, with its year when it isn't this year's. */}
          {hiddenAt !== null &&
            ` · Hidden on ${formatDayHeading(yerevanToday(new Date(hiddenAt)), today)}`}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-6">
          {/* The everyday step first. Hiding is rare, and asks first. */}
          {isPublished && hiddenAt === null && (
            <LinkButton
              variant="link"
              to={`/restaurants/${slug}`}
              aria-label={`See the guests’ page of ${name}`}
            >
              See the guests’ page
            </LinkButton>
          )}
          {hiddenAt !== null ? (
            <Button
              variant="link"
              aria-label={`Show ${name} again`}
              loading={changing}
              onClick={() => onShow(restaurant)}
            >
              Show again
            </Button>
          ) : (
            <Button
              variant="link"
              aria-label={`Hide ${name}`}
              loading={changing}
              onClick={() => onHide(restaurant)}
            >
              Hide
            </Button>
          )}
        </div>
      </div>
      {/* What guests see: Hidden by Seghan wins over the owner's own choice. */}
      <PublishedBadge isPublished={isPublished} hiddenBySeghan={hiddenAt !== null} />
    </li>
  );
}

export interface AdminRestaurantsProps {
  filters: AdminRestaurantFilters;
  onFiltersChange: (filters: AdminRestaurantFilters) => void;
  list: AdminListState<AdminRestaurant>;
  hrefFor: (page: number) => To;
  /** Today in Yerevan, so a day this year is shown without its year. */
  today: string;
  /** The restaurant whose change is being sent. */
  changingId: string | null;
  /** The restaurant just hidden or shown again, as the server answered. */
  changed: AdminRestaurant | null;
  /** Why the last change was refused, or couldn't be sent. */
  refusal: ApiError | null;
  onHide: (restaurant: AdminRestaurant) => void;
  onShow: (restaurant: AdminRestaurant) => void;
  className?: string;
}

/**
 * Every restaurant on Seghan, drafts and hidden ones included, by name, each with its owner and
 * what guests see of it. Hiding one asks first, because guests lose it at once. Showing one again
 * happens at once: the owner's own choice, published or a draft, then applies again.
 */
export function AdminRestaurants({
  filters,
  onFiltersChange,
  list,
  hrefFor,
  today,
  changingId,
  changed,
  refusal,
  onHide,
  onShow,
  className,
}: AdminRestaurantsProps): ReactElement {
  const [asking, setAsking] = useState<AdminRestaurant | null>(null);
  const noticeRef = useRef<HTMLDivElement>(null);

  // The button just pressed changes or leaves with its line, so focus moves to what happened.
  useEffect(() => {
    if (changed || refusal) noticeRef.current?.focus();
  }, [changed, refusal]);

  const change = (next: Partial<AdminRestaurantFilters>): void =>
    onFiltersChange({ ...filters, ...next, page: 1 });

  function hide(): void {
    if (asking) onHide(asking);
    setAsking(null);
  }

  return (
    <div className={cx("flex flex-col gap-8", className)}>
      <AdminFilterBar
        key={filters.q ?? ""}
        label="Restaurants"
        q={filters.q}
        placeholder="Name or street"
        onSearch={(q) => change({ q })}
        choices={1}
      >
        <Select
          label="Show"
          value={filters.show ?? ""}
          onChange={(event) => change({ show: oneOf(RESTAURANT_SHOWS, event.target.value) })}
        >
          <option value="">Every restaurant</option>
          {RESTAURANT_SHOWS.map((show) => (
            <option key={show} value={show}>
              {SHOW_CHOICES[show]}
            </option>
          ))}
        </Select>
      </AdminFilterBar>

      {(changed || refusal) && (
        <div ref={noticeRef} tabIndex={-1} className="max-w-160 outline-hidden">
          {refusal ? (
            <FormNotice>{refusal.message}</FormNotice>
          ) : (
            changed && <FormNotice tone="success">{visibilityWords(changed)}</FormNotice>
          )}
        </div>
      )}

      <AdminListBody
        list={list}
        words={words}
        filtered={isFiltered(filters)}
        onClearFilters={() => onFiltersChange({ page: 1 })}
        onFirstPage={() => onFiltersChange({ ...filters, page: 1 })}
        hrefFor={hrefFor}
      >
        {(restaurants) => (
          <ul className="border-t border-line">
            {restaurants.map((restaurant) => (
              <RestaurantLine
                key={restaurant.id}
                restaurant={restaurant}
                today={today}
                changing={changingId === restaurant.id}
                onHide={setAsking}
                onShow={onShow}
              />
            ))}
          </ul>
        )}
      </AdminListBody>

      <Modal
        open={asking !== null}
        onClose={() => setAsking(null)}
        title="Hide this restaurant?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAsking(null)}>
              Don’t hide
            </Button>
            <Button onClick={hide}>Hide restaurant</Button>
          </>
        }
      >
        {asking &&
          `Guests won’t find or book ${asking.name} until you show it again. Its bookings stay as they are, and its owner sees that Seghan hid it.`}
      </Modal>
    </div>
  );
}
