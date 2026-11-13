import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { useNavigate } from "react-router";

import { Figures } from "@/components/Figures";
import { Pagination } from "@/components/Pagination";
import { PartHeader } from "@/components/PartHeader";
import { BookingChangeNotice } from "@/features/dashboard/components/BookingChangeNotice";
import { DayBookings } from "@/features/dashboard/components/DayBookings";
import { DayNav } from "@/features/dashboard/components/DayNav";
import {
  DashboardLoadFailed,
  DashboardLoading,
  NoBookingsThatDay,
} from "@/features/dashboard/components/DashboardStates";
import { useDashboardRestaurant } from "@/features/dashboard/hooks/useDashboardRestaurant";
import { useDayParams } from "@/features/dashboard/hooks/useDayParams";
import {
  useChangeBooking,
  useDayReservations,
} from "@/features/dashboard/hooks/useDayReservations";
import { useOpeningHours } from "@/features/dashboard/hooks/useOpeningHours";
import { dayFigures, dayHoursWords } from "@/features/dashboard/labels";
import { formatDayHeading, weekdayOf, yerevanToday } from "@/lib/time";

/**
 * A restaurant's reservations for one day, as the export's dashboard has them: the day and its
 * hours, the days on either side, the day at a glance in four figures, then the bookings. It's
 * today unless the address names another day, asked for again every 30 seconds. Each booking offers
 * the changes the server allows now.
 */
export function DashboardBookingsPage(): ReactElement {
  const restaurant = useDashboardRestaurant();
  const navigate = useNavigate();
  // Read once, when the page opens: a page has to render the same way each time.
  const [today] = useState(() => yerevanToday());
  const { date, page, dayHref, pageHref } = useDayParams(today);
  const day = useDayReservations(restaurant.id, date, page);
  // The week's hours, to say the day's under its name. The Opening hours part asks the same.
  const hours = useOpeningHours(restaurant.id);
  const retrying = day.isFetching && day.errorUpdateCount > 0;
  const change = useChangeBooking(restaurant.id);
  const { reset } = change;

  // What was said about the last change belongs to the day it was made on.
  useEffect(() => {
    reset();
  }, [date, page, reset]);

  const changing =
    change.isPending && change.variables
      ? { id: change.variables.reservation.id, status: change.variables.status }
      : null;

  let body: ReactElement;
  if (day.data && day.data.data.length > 0) {
    const { data: bookings, meta } = day.data;
    const pageCount = Math.ceil(meta.total / meta.pageSize);
    body = (
      <>
        {/* The figures need every booking of the day, so they wait for a day on one page. */}
        {pageCount === 1 && (
          <Figures figures={dayFigures(bookings, date === today)} className="mb-6" />
        )}
        <DayBookings
          reservations={bookings}
          onChange={(reservation, next) => change.mutate({ reservation, ...next })}
          changing={changing}
          narrowing={pageCount === 1}
        />
        <Pagination page={page} pageCount={pageCount} hrefFor={pageHref} className="mt-8" />
      </>
    );
  } else if (day.data) {
    body = <NoBookingsThatDay />;
  } else if (day.isError || retrying) {
    body = (
      <DashboardLoadFailed
        what="the bookings"
        onRetry={() => void day.refetch()}
        retrying={retrying}
      />
    );
  } else {
    body = <DashboardLoading label="Loading the bookings" />;
  }

  return (
    <>
      <title>{`Reservations · ${restaurant.name} · Seghan`}</title>
      <PartHeader
        title="Reservations"
        description={
          hours.data
            ? `${formatDayHeading(date, today)} · ${dayHoursWords(hours.data, weekdayOf(date))}`
            : formatDayHeading(date, today)
        }
        action={
          <DayNav
            date={date}
            today={today}
            hrefFor={dayHref}
            onGoTo={(chosen) => void navigate(dayHref(chosen))}
          />
        }
        className="mb-6"
      />
      <div>
        <BookingChangeNotice
          changed={change.data ?? null}
          refusal={change.error}
          className="mb-6"
        />
        {body}
      </div>
    </>
  );
}
