import type { ReactElement } from "react";
import type { To } from "react-router";

import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Pagination } from "@/components/Pagination";
import { Spinner } from "@/components/Spinner";
import { RestaurantGrid } from "@/features/restaurants/components/RestaurantGrid";
import { cx } from "@/lib/cx";
import type { ListResponse, RestaurantSummary } from "@/types/api";

interface BrowseResultsProps {
  /** The current page of results, or undefined before the first answer. */
  results?: ListResponse<RestaurantSummary>;
  /** The first answer didn't come. */
  failed?: boolean;
  /** True while Try again runs. */
  retrying?: boolean;
  onRetry: () => void;
  /** Newer results are on their way. The last ones stay on screen meanwhile. */
  updating?: boolean;
  /** True when a search or filter narrows the list. */
  filtered: boolean;
  onClearFilters: () => void;
  /** For a page number past the end, such as one from an old link. */
  onFirstPage: () => void;
  hrefFor: (page: number) => To;
  /** The cards' heading level: h2 under the page's title. */
  cardHeading?: "h2" | "h3" | "h4";
  className?: string;
}

const restaurantsCount = (total: number): string =>
  total === 1 ? "1 restaurant" : `${total} restaurants`;

/** Browse's results in every state: loading, failed, nothing found, and a page of restaurants. */
export function BrowseResults({
  results,
  failed = false,
  retrying = false,
  onRetry,
  updating = false,
  filtered,
  onClearFilters,
  onFirstPage,
  hrefFor,
  cardHeading = "h2",
  className,
}: BrowseResultsProps): ReactElement {
  if (!results) {
    // A retry clears the error while it runs. Staying on the error keeps Try again on the page.
    if (failed || retrying) {
      return (
        <ErrorState
          title="Our apologies"
          description="We couldn’t load the restaurants."
          onRetry={onRetry}
          retrying={retrying}
          className={className}
        />
      );
    }
    return (
      <div className={cx("flex min-h-60 items-center justify-center", className)}>
        <Spinner label="Loading restaurants" />
      </div>
    );
  }

  const { data, meta } = results;

  if (meta.total === 0) {
    return filtered ? (
      <EmptyState
        title="No restaurants match"
        description="Try a different search, cuisine, district or price."
        action={{ label: "Clear filters", onClick: onClearFilters }}
        className={className}
      />
    ) : (
      <EmptyState
        title="No restaurants yet"
        description="Restaurants appear here once they’re published."
        className={className}
      />
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title="This page is empty"
        description={`There are ${restaurantsCount(meta.total)} on earlier pages.`}
        action={{ label: "Go to the first page", onClick: onFirstPage }}
        className={className}
      />
    );
  }

  return (
    <section aria-label="Restaurants" aria-busy={updating || undefined} className={className}>
      <div className="flex flex-wrap items-baseline gap-x-4">
        {/* Read out when the filters change, so screen reader users hear what they found. */}
        <p role="status" className="text-ui text-ink-secondary">
          {restaurantsCount(meta.total)}
        </p>
        {filtered && (
          <Button variant="link" onClick={onClearFilters}>
            Clear filters
          </Button>
        )}
      </div>
      <RestaurantGrid
        restaurants={data}
        cardHeading={cardHeading}
        className={cx("mt-6 transition-opacity duration-button", updating && "opacity-60")}
      />
      <Pagination
        page={meta.page}
        pageCount={Math.ceil(meta.total / meta.pageSize)}
        hrefFor={hrefFor}
        className="mt-14"
      />
    </section>
  );
}
