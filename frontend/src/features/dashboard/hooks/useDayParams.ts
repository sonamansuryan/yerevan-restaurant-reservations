import { useSearchParams } from "react-router";
import type { To } from "react-router";

import { isCalendarDate } from "@/lib/time";

export interface DayParams {
  /** The day to show, as YYYY-MM-DD on the restaurant's calendar. */
  date: string;
  page: number;
  /** Where a day lives: ?date=2026-11-14. */
  dayHref: (date: string) => To;
  /** Where a page of the same day lives: ?date=2026-11-14&page=2. */
  pageHref: (page: number) => To;
}

/**
 * The day and page in the address, so a day can be bookmarked, shared and reached with Back. A
 * missing date, or one that isn't real, such as 2026-02-30, means today.
 */
export function useDayParams(today: string): DayParams {
  const [params] = useSearchParams();
  const asked = params.get("date") ?? "";
  const date = isCalendarDate(asked) ? asked : today;
  const askedPage = Number(params.get("page") ?? "1");
  // The API's own limits for a page.
  const page = Number.isInteger(askedPage) && askedPage >= 1 && askedPage <= 1000 ? askedPage : 1;

  return {
    date,
    page,
    dayHref: (day) => ({ search: `?${new URLSearchParams({ date: day }).toString()}` }),
    pageHref: (to) => {
      const query = new URLSearchParams({ date });
      if (to > 1) query.set("page", String(to));
      return { search: `?${query.toString()}` };
    },
  };
}
