import type { ReactElement, ReactNode } from "react";
import type { To } from "react-router";

import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Pagination } from "@/components/Pagination";
import {
  DashboardLoadFailed,
  DashboardLoading,
} from "@/features/dashboard/components/DashboardStates";
import { cx } from "@/lib/cx";
import type { ListResponse } from "@/types/api";

/** One of the admin's lists, as its page has it. */
export interface AdminListState<T> {
  /** The page of rows, once it has come. */
  data: ListResponse<T> | undefined;
  /** The first answer didn't come. */
  failed: boolean;
  /** True while Try again runs. */
  retrying: boolean;
  onRetry: () => void;
  /** Newer rows are on their way. The last ones stay on screen meanwhile. */
  updating: boolean;
}

/** What a list holds, in the words its states use. */
export interface AdminListWords {
  /** What screen readers call the list, such as "Restaurants". */
  label: string;
  /** Read out while it loads, such as "Loading the restaurants". */
  loading: string;
  /** After "We couldn’t load", such as "the restaurants". */
  what: string;
  /** Such as "3 restaurants". */
  count: (total: number) => string;
  /** When there's nothing at all yet. */
  none: { title: string; description: string };
  /** When the search and filters match nothing. */
  noMatch: { title: string; description: string };
}

interface AdminListBodyProps<T> {
  list: AdminListState<T>;
  words: AdminListWords;
  /** True when a search or filter narrows the list. */
  filtered: boolean;
  onClearFilters: () => void;
  /** For a page number past the end, such as one from an old link. */
  onFirstPage: () => void;
  hrefFor: (page: number) => To;
  /** The rows of this page, as lines. */
  children: (rows: T[]) => ReactNode;
}

/**
 * Any admin list in each of its states: loading, failed, nothing yet, nothing matching, a page past
 * the end, and a page of lines with how many there are and the pages below. It works as Browse's
 * results do, with the dashboard's own loading and failed states.
 */
export function AdminListBody<T>({
  list,
  words,
  filtered,
  onClearFilters,
  onFirstPage,
  hrefFor,
  children,
}: AdminListBodyProps<T>): ReactElement {
  if (!list.data) {
    // A retry clears the error while it runs. Staying on the error keeps Try again on the page.
    return list.failed || list.retrying ? (
      <DashboardLoadFailed what={words.what} onRetry={list.onRetry} retrying={list.retrying} />
    ) : (
      <DashboardLoading label={words.loading} />
    );
  }

  const { data, meta } = list.data;

  if (meta.total === 0) {
    return filtered ? (
      <EmptyState
        title={words.noMatch.title}
        description={words.noMatch.description}
        action={{ label: "Clear filters", onClick: onClearFilters }}
      />
    ) : (
      <EmptyState title={words.none.title} description={words.none.description} />
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title="This page is empty"
        description={`There are ${words.count(meta.total)} on earlier pages.`}
        action={{ label: "Go to the first page", onClick: onFirstPage }}
      />
    );
  }

  return (
    <section aria-label={words.label} aria-busy={list.updating || undefined}>
      <div className="flex flex-wrap items-baseline gap-x-4">
        {/* Read out when the filters change, so screen reader users hear what they found. */}
        <p role="status" className="text-ui text-ink-secondary">
          {words.count(meta.total)}
        </p>
        {filtered && (
          <Button variant="link" onClick={onClearFilters}>
            Clear filters
          </Button>
        )}
      </div>
      <div className={cx("mt-4 transition-opacity duration-button", list.updating && "opacity-60")}>
        {children(data)}
      </div>
      <Pagination
        page={meta.page}
        pageCount={Math.ceil(meta.total / meta.pageSize)}
        hrefFor={hrefFor}
        className="mt-8"
      />
    </section>
  );
}
