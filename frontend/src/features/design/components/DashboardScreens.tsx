import type { ReactElement, ReactNode } from "react";
import type { To } from "react-router";

import { DayBookings } from "@/features/dashboard/components/DayBookings";
import { DayNav } from "@/features/dashboard/components/DayNav";
import {
  DashboardLoadFailed,
  DashboardLoading,
  NoBookingsThatDay,
  NoRestaurantsYet,
} from "@/features/dashboard/components/DashboardStates";
import { JustAddedNotice } from "@/features/dashboard/components/JustAddedNotice";
import { OpeningHoursForm } from "@/features/dashboard/components/OpeningHoursForm";
import { PhotoManager } from "@/features/dashboard/components/PhotoManager";
import { PublishPanel } from "@/features/dashboard/components/PublishPanel";
import { RestaurantForm } from "@/features/dashboard/components/RestaurantForm";
import { RestaurantHeader } from "@/features/dashboard/components/RestaurantHeader";
import { RestaurantList } from "@/features/dashboard/components/RestaurantList";
import { UPLOAD_FAILED } from "@/features/dashboard/hooks/usePhotos";
import { weekFields } from "@/features/dashboard/hours";
import { daySummary } from "@/features/dashboard/labels";
import { NEW_RESTAURANT, restaurantFields } from "@/features/dashboard/schemas";
import { Group, Specimens } from "@/features/design/components/parts";
import {
  fridayBookings,
  ownedDraft,
  ownedLori,
  ownedRestaurants,
  samplePhotos,
  splitWeek,
  tenPhotos,
  tsiranPage,
} from "@/features/design/samples";
import { screenStates } from "@/features/design/tokens";
import { ApiError } from "@/lib/api";

type StateOf<K extends keyof typeof screenStates> = (typeof screenStates)[K][number];

const ignore = (): void => {};
// Days in these specimens can't be followed, so they all point here.
const stay = (): To => ({ hash: "#screens" });

// The server's answers, exactly as api.ts hands them over.
const noConnection = new ApiError(
  0,
  "NETWORK_ERROR",
  "We can't reach the server right now. Please try again.",
);
const notReady = new ApiError(
  409,
  "NOT_READY_TO_PUBLISH",
  "Add at least one table and your opening hours before you publish.",
  { missing: ["TABLE", "OPENING_HOURS"] },
);
const uploadFailed = new ApiError(0, "UPLOAD_FAILED", UPLOAD_FAILED);

// Each week here is small on purpose: every opening is two lists of 96 times, and /design's tests
// draw the whole page many times over.
const tsiranWeek = weekFields(tsiranPage.openingHours);
// Lunch on Monday, and a second opening that starts before lunch ends. The server names it by its
// place in the list sent: the second.
const overlapping = {
  hours: [
    { dayOfWeek: 1, opens: String(12 * 60), closes: String(15 * 60) },
    { dayOfWeek: 1, opens: String(14 * 60), closes: String(16 * 60) },
  ],
};
// One late opening, Friday 18:00 to 02:00, for the states that are only about the button.
const oneOpening = { hours: [{ dayOfWeek: 5, opens: String(18 * 60), closes: String(2 * 60) }] };
const overlap = new ApiError(400, "VALIDATION_ERROR", "The request is invalid.", {
  fields: { "hours.1": "Overlaps Monday 12:00–15:00." },
});
const emptyWeek = new ApiError(400, "VALIDATION_ERROR", "The request is invalid.", {
  fields: { hours: "Add at least one opening time." },
});

const loriFields = restaurantFields(ownedLori);
const mistakes = {
  ...NEW_RESTAURANT,
  name: "",
  phone: "call us",
  website: "lori.am",
};

const list: Record<StateOf<"dashboardList">, ReactElement> = {
  "Your restaurants": <RestaurantList restaurants={ownedRestaurants} />,
  "No restaurants yet": <NoRestaurantsYet onAdd={ignore} />,
  Loading: <DashboardLoading label="Loading your restaurants" />,
  "Couldn’t load": (
    <DashboardLoadFailed what="your restaurants" onRetry={ignore} retrying={false} />
  ),
};

// The parts' links start at this page's address, so the first, Bookings, shows as open.
const header: Record<StateOf<"dashboardHeader">, ReactElement> = {
  Published: <RestaurantHeader restaurant={ownedLori} headingLevel={4} sectionsBase="/design" />,
  "A draft, with a long Armenian name": (
    <RestaurantHeader restaurant={ownedDraft} headingLevel={4} sectionsBase="/design" />
  ),
};

const FRIDAY = "2026-11-13";

/** A day's page as Bookings shows it: the date, the days around it, then what's booked. */
function Day({ date, children }: { date: string; children: ReactNode }): ReactElement {
  return (
    <div>
      <DayNav date={date} today={FRIDAY} hrefFor={stay} onGoTo={ignore} headingLevel={4} />
      <div className="mt-8">{children}</div>
    </div>
  );
}

const day: Record<StateOf<"dayBookings">, ReactElement> = {
  "Today, a full book (live)": (
    <Day date={FRIDAY}>
      <p className="mb-4 text-ui text-ink-secondary">{daySummary(fridayBookings)}</p>
      <DayBookings reservations={fridayBookings} />
    </Day>
  ),
  "Another day, no bookings": (
    <Day date="2026-11-16">
      <NoBookingsThatDay />
    </Day>
  ),
  Loading: (
    <Day date={FRIDAY}>
      <DashboardLoading label="Loading the bookings" />
    </Day>
  ),
  "Couldn’t load": (
    <Day date={FRIDAY}>
      <DashboardLoadFailed what="the bookings" onRetry={ignore} retrying={false} />
    </Day>
  ),
};

const publish: Record<StateOf<"publishPanel">, ReactElement> = {
  "Just added": (
    <div className="flex flex-col gap-12">
      <JustAddedNotice restaurantId={ownedDraft.id} />
      <PublishPanel isPublished={false} onChange={ignore} headingLevel={4} />
    </div>
  ),
  "A draft": <PublishPanel isPublished={false} onChange={ignore} headingLevel={4} />,
  Published: <PublishPanel isPublished onChange={ignore} headingLevel={4} />,
  Publishing: <PublishPanel isPublished={false} onChange={ignore} pending headingLevel={4} />,
  "Not ready to publish": (
    <PublishPanel isPublished={false} onChange={ignore} error={notReady} headingLevel={4} />
  ),
};

const form: Record<StateOf<"restaurantForm">, ReactElement> = {
  "A new restaurant (live)": (
    <RestaurantForm
      values={NEW_RESTAURANT}
      submitLabel="Add the restaurant"
      onSubmit={ignore}
      headingLevel={4}
    />
  ),
  "Field errors": (
    <RestaurantForm
      values={mistakes}
      submitLabel="Add the restaurant"
      onSubmit={ignore}
      validateOnMount
      headingLevel={4}
    />
  ),
  Sending: (
    <RestaurantForm
      values={loriFields}
      submitLabel="Save changes"
      onSubmit={ignore}
      pending
      headingLevel={4}
    />
  ),
  Saved: (
    <RestaurantForm
      values={loriFields}
      submitLabel="Save changes"
      onSubmit={ignore}
      saved
      headingLevel={4}
    />
  ),
  "No connection": (
    <RestaurantForm
      values={loriFields}
      submitLabel="Save changes"
      onSubmit={ignore}
      error={noConnection}
      headingLevel={4}
    />
  ),
};

const hours: Record<StateOf<"openingHours">, ReactElement> = {
  "Split shifts (live)": <OpeningHoursForm values={weekFields(splitWeek)} onSubmit={ignore} />,
  "Late nights and a closed day": <OpeningHoursForm values={tsiranWeek} onSubmit={ignore} />,
  "No hours yet": <OpeningHoursForm values={{ hours: [] }} onSubmit={ignore} />,
  "An overlap": <OpeningHoursForm values={overlapping} onSubmit={ignore} error={overlap} />,
  "An empty week": <OpeningHoursForm values={{ hours: [] }} onSubmit={ignore} error={emptyWeek} />,
  Sending: <OpeningHoursForm values={oneOpening} onSubmit={ignore} pending />,
  Saved: <OpeningHoursForm values={oneOpening} onSubmit={ignore} saved />,
};

const photoActions = {
  restaurantName: "Lori Smokehouse",
  onUpload: ignore,
  onMakeCover: ignore,
  onDelete: ignore,
};

const photos: Record<StateOf<"photos">, ReactElement> = {
  "A cover and photos (live)": <PhotoManager photos={samplePhotos} {...photoActions} />,
  "No photos yet": <PhotoManager photos={[]} {...photoActions} />,
  Uploading: <PhotoManager photos={samplePhotos} uploading {...photoActions} />,
  "The limit": <PhotoManager photos={tenPhotos} {...photoActions} />,
  "Upload failed": <PhotoManager photos={samplePhotos} error={uploadFailed} {...photoActions} />,
};

/** The owner's dashboard, /dashboard and each restaurant's parts, in their states. */
export function DashboardScreens(): ReactElement {
  return (
    <>
      <Group
        title="Your restaurants"
        note="/dashboard: the owner's restaurants as lines in the book, each opening its own dashboard. Add a restaurant opens the form below, under Restaurant information."
      >
        <Specimens wide specimens={list} />
      </Group>
      <Group
        title="A restaurant's dashboard"
        note="The top of every part: the name, whether guests can see it, and the parts. Someone else's restaurant gets the not-found page: see it under Responsive."
      >
        <Specimens wide specimens={header} />
      </Group>
      <Group
        title="Bookings"
        note="The first part, one day at a time, view only. The date is in the address, so Back works and a day can be bookmarked. A booking belongs to the day it starts on, so 22:30 to 00:30 is Friday's. The live one's date can be tried, and goes nowhere."
      >
        <Specimens wide specimens={day} />
      </Group>
      <Group
        title="Visibility"
        note="At the top of Information. The server decides whether a restaurant is ready, and its words say what's missing."
      >
        <Specimens wide specimens={publish} />
      </Group>
      <Group
        title="Restaurant information"
        note="The same form adds a restaurant and edits one. It checks the server's rules first, in the server's words. The live one sends nothing."
      >
        <Specimens wide specimens={form} />
      </Group>
      <Group
        title="Opening hours"
        note="The whole week, Monday first, saved at once. A closing at or before the opening is the next day's. Up to three openings a day. Overlaps are found by the server and shown under the opening."
      >
        <Specimens wide specimens={hours} />
      </Group>
      <Group
        title="Photos"
        note="The cover first, as guests see it. Sample squares stand in for photos here. In the live one, Delete asks first: the question opens over the page, so it can't be shown frozen."
      >
        <Specimens wide specimens={photos} />
      </Group>
    </>
  );
}
