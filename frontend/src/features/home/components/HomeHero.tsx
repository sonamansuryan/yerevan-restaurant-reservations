import type { ReactElement } from "react";
import { Link } from "react-router";

import { PageContainer } from "@/components/PageContainer";
import { HOME_CUISINES, restaurantsWords } from "@/features/home/home";
import { filtersToParams } from "@/features/restaurants/browseFilters";
import { RestaurantSearch } from "@/features/restaurants/components/RestaurantSearch";
import { CUISINE_LABELS } from "@/features/restaurants/labels";
import type { TableQuery } from "@/features/restaurants/tableSearch";

interface HomeHeroProps {
  /** How many restaurants Seghan lists, once known. */
  total?: number;
  /** The table the search starts at: today, about 19:30, for two. */
  query: TableQuery;
  /** Today in Yerevan, the first day the search offers. */
  today: string;
  /** h1 on the page. /design shows it under its own headings, so the page keeps one h1. */
  heading?: "h1" | "h4";
}

/**
 * The home page's opening, on a dark band the width of the window, as the export has it: where we
 * are, the headline, the search for a table, and cuisines to browse. It's branding, so the headline may be expressive, and it
 * ends with a full stop. The page is always long enough to scroll, so the band never leaves the
 * pale strip a short page would, where the scrollbar's space is kept.
 */
export function HomeHero({
  total,
  query,
  today,
  heading: Heading = "h1",
}: HomeHeroProps): ReactElement {
  return (
    <section aria-labelledby="home-title" className="surface-dark">
      <PageContainer className="flex flex-col gap-7 pt-14 pb-16 md:pt-18 md:pb-22">
        <p className="text-eyebrow text-accent-on-dark uppercase">
          {total ? `Yerevan · ${restaurantsWords(total)} taking bookings` : "Yerevan"}
        </p>
        <Heading
          id="home-title"
          className="max-w-205 font-grotesque text-headline font-bold text-balance"
        >
          Find a table in Yerevan, tonight or any night.
        </Heading>
        <RestaurantSearch query={query} today={today} className="max-w-260" />
        <nav aria-label="Cuisines">
          <ul className="flex flex-wrap gap-2">
            {HOME_CUISINES.map((cuisine) => (
              <li key={cuisine}>
                <Link
                  to={{
                    pathname: "/restaurants",
                    search: `?${filtersToParams({ cuisine, page: 1 }).toString()}`,
                  }}
                  className="inline-flex min-h-9 items-center rounded-pill border border-on-dark/30 px-4 text-ui text-on-dark transition-[border-color] duration-button hover:border-on-dark any-pointer-coarse:min-h-touch"
                >
                  {CUISINE_LABELS[cuisine]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </PageContainer>
    </section>
  );
}
