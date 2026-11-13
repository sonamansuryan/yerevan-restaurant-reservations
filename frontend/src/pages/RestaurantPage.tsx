import { useState } from "react";
import type { ReactElement } from "react";
import { useParams } from "react-router";

import { LinkButton } from "@/components/Button";
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
import { yerevanWeekday } from "@/lib/time";
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
  const reviews = useRestaurantReviews(restaurant.slug, restaurant.reviewCount);
  const save = useSaveRestaurant(restaurant.slug);

  return (
    <PageContainer className="py-section-sm">
      <title>{`${restaurant.name} · Seghan`}</title>
      {/* The way back on the left, and saving it on the right, on the first baseline of each. */}
      <div className="flex items-baseline justify-between gap-4">
        <LinkButton variant="link" to="/restaurants">
          All restaurants
        </LinkButton>
        {save && <SaveRestaurant name={restaurant.name} viewer={save} />}
      </div>
      <RestaurantDetails
        restaurant={restaurant}
        today={today}
        booking={<Booking slug={restaurant.slug} />}
        reviews={reviews}
        map={
          // A new map for each restaurant, so one that failed doesn't stay hidden for the next.
          <RestaurantMap
            key={restaurant.mapImageUrl}
            src={restaurant.mapImageUrl}
            mapsUrl={restaurant.mapsUrl}
            className="mt-4"
          />
        }
        className="mt-4"
      />
    </PageContainer>
  );
}
