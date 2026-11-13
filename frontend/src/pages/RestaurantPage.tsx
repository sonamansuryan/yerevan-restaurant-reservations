import { useState } from "react";
import type { ReactElement } from "react";
import { useParams } from "react-router";

import { PageContainer } from "@/components/PageContainer";
import { BookingWidget } from "@/features/booking/components/BookingWidget";
import { useBooking } from "@/features/booking/hooks/useBooking";
import { SaveRestaurant } from "@/features/favorites/components/SaveRestaurant";
import { useSaveRestaurant } from "@/features/favorites/hooks/useSaveRestaurant";
import { RestaurantDetails } from "@/features/restaurants/components/RestaurantDetails";
import {
  RestaurantLoadFailed,
  RestaurantLoading,
} from "@/features/restaurants/components/RestaurantStates";
import { RestaurantMap } from "@/features/restaurants/components/RestaurantMap";
import { useRestaurant } from "@/features/restaurants/hooks/useRestaurant";
import { useRestaurantReviews } from "@/features/reviews/hooks/useRestaurantReviews";
import { yerevanClock, yerevanWeekday } from "@/lib/time";
import { NotFoundPage } from "@/pages/NotFoundPage";
import type { RestaurantDetail } from "@/types/api";

export function RestaurantPage(): ReactElement {
  const { slug = "" } = useParams();
  const restaurant = useRestaurant(slug);

  if (restaurant.data) return <LoadedRestaurant restaurant={restaurant.data} />;

  // The API answers alike for a restaurant that doesn't exist and one that isn't published.
  if (restaurant.error?.status === 404) {
    return (
      <NotFoundPage
        title="Restaurant not found"
        description="The link may be out of date, or the restaurant may not be on Seghan yet."
        action={{ to: "/restaurants", label: "See all restaurants" }}
      />
    );
  }

  // A retry clears the error while it runs. Staying on the error keeps Try again on the page.
  const retrying = restaurant.isFetching && restaurant.errorUpdateCount > 0;
  if (restaurant.isError || retrying) {
    return (
      <PageContainer className="flex flex-col items-center py-section-sm md:py-section-lg">
        <title>Something went wrong · Seghan</title>
        <h1 className="sr-only">Something went wrong</h1>
        <RestaurantLoadFailed onRetry={() => void restaurant.refetch()} retrying={retrying} />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="page-fill flex items-center justify-center py-section-sm">
      <RestaurantLoading />
    </PageContainer>
  );
}

/**
 * The booking widget, with its own choices and times. On a demo listing (9.7) it books its sample
 * tables like any others, under one line saying the restaurant won't receive the booking.
 */
function Booking({ slug }: { slug: string }): ReactElement {
  const booking = useBooking(slug);
  return <BookingWidget {...booking} />;
}

function LoadedRestaurant({ restaurant }: { restaurant: RestaurantDetail }): ReactElement {
  // Read once, when the page opens: a page has to render the same way each time.
  const [today] = useState(() => yerevanWeekday(new Date()));
  const [now] = useState(() => yerevanClock());
  const reviews = useRestaurantReviews(restaurant.slug, restaurant.reviewCount);
  const save = useSaveRestaurant(restaurant.slug);

  return (
    // On a phone the photo meets the header, as the export's phone screen has it.
    <PageContainer className="pb-section-sm lg:pt-8">
      <title>{`${restaurant.name} · Seghan`}</title>
      <RestaurantDetails
        restaurant={restaurant}
        today={today}
        now={now}
        booking={<Booking slug={restaurant.slug} />}
        save={save && <SaveRestaurant name={restaurant.name} viewer={save} />}
        reviews={reviews}
        map={
          // A new map for each restaurant, so one that failed doesn't stay hidden for the next.
          <RestaurantMap
            key={restaurant.mapImageUrl}
            src={restaurant.mapImageUrl}
            mapsUrl={restaurant.mapsUrl}
            // With no map, or one that couldn't load, the address stands in its place.
            fallback={<address className="text-input not-italic">{restaurant.address}</address>}
          />
        }
      />
    </PageContainer>
  );
}
