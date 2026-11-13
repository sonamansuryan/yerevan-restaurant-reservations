import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import type { To } from "react-router";

import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { FormNotice } from "@/components/FormNotice";
import { Pagination } from "@/components/Pagination";
import { SaveButton } from "@/components/SaveButton";
import { Spinner } from "@/components/Spinner";
import { RestaurantGrid } from "@/features/restaurants/components/RestaurantGrid";
import type { ApiError } from "@/lib/api";
import { cx } from "@/lib/cx";
import type { ListResponse, RestaurantSummary } from "@/types/api";

export interface FavoriteListState {
  /** The page of favorites, once it has come. */
  data: ListResponse<RestaurantSummary> | undefined;
  failed: boolean;
  retrying: boolean;
  onRetry: () => void;
}

/** The last change made here: a restaurant taken out, or put back with Undo. */
export interface FavoriteChange {
  restaurant: RestaurantSummary;
  saved: boolean;
}

export interface MyFavoritesProps {
  page: number;
  list: FavoriteListState;
  /** Where each page lives. Pages are links, so Back returns. */
  hrefFor: (page: number) => To;
  /** The restaurant being taken out or put back right now. */
  changingSlug: string | null;
  /** The change just made, to say so. */
  changed: FavoriteChange | null;
  /** Why the last change was refused, or couldn't be sent. */
  refusal: ApiError | null;
  onRemove: (restaurant: RestaurantSummary) => void;
  /** Puts back the restaurant just taken out. */
  onUndo: (restaurant: RestaurantSummary) => void;
  onFindARestaurant: () => void;
  onFirstPage: () => void;
  /** The cards' heading level: h2 under the page's title, lower inside /design. */
  cardHeading?: "h2" | "h4";
  className?: string;
}

const restaurantsWords = (total: number): string =>
  total === 1 ? "1 restaurant" : `${total} restaurants`;

/**
 * The restaurants a guest saved, the last saved first, as cards like Browse's. Each card keeps its
 * Saved toggle: pressing it takes the restaurant out, and Undo puts it back.
 */
export function MyFavorites({
  page,
  list,
  hrefFor,
  changingSlug,
  changed,
  refusal,
  onRemove,
  onUndo,
  onFindARestaurant,
  onFirstPage,
  cardHeading = "h2",
  className,
}: MyFavoritesProps): ReactElement {
  const noticeRef = useRef<HTMLDivElement>(null);

  // The card just taken out is gone, and Undo goes once it's done, so focus moves to what happened.
  useEffect(() => {
    if (changed || refusal) noticeRef.current?.focus();
  }, [changed, refusal]);

  let content: ReactElement;
  if (list.failed) {
    content = (
      <div className="flex flex-col items-center">
        <ErrorState
          title="Our apologies"
          description="We couldn’t load your favorites."
          onRetry={list.onRetry}
          retrying={list.retrying}
          className="w-full max-w-120"
        />
      </div>
    );
  } else if (!list.data) {
    content = (
      <div className="flex min-h-40 items-center justify-center">
        <Spinner label="Loading your favorites" />
      </div>
    );
  } else if (list.data.data.length === 0 && list.data.meta.total > 0) {
    // An old link, or favorites taken out meanwhile, can leave a page empty.
    content = (
      <EmptyState
        title="This page is empty"
        description={`There are ${restaurantsWords(list.data.meta.total)} on earlier pages.`}
        action={{ label: "Go to the first page", onClick: onFirstPage }}
      />
    );
  } else if (list.data.data.length === 0) {
    content = (
      <EmptyState
        title="No favorites yet"
        description="Save a restaurant from its page, and it will be listed here."
        action={{ label: "Find a restaurant", onClick: onFindARestaurant }}
      />
    );
  } else {
    const { data, meta } = list.data;
    content = (
      <div className="flex flex-col gap-14">
        <RestaurantGrid
          restaurants={data}
          cardHeading={cardHeading}
          actionFor={(restaurant) => (
            <SaveButton
              saved
              name={restaurant.name}
              loading={changingSlug === restaurant.slug}
              onClick={() => onRemove(restaurant)}
            />
          )}
        />
        <Pagination
          page={page}
          pageCount={Math.ceil(meta.total / meta.pageSize)}
          hrefFor={hrefFor}
        />
      </div>
    );
  }

  return (
    <div className={cx("flex flex-col gap-8", className)}>
      {(changed || refusal) && (
        <div ref={noticeRef} tabIndex={-1} className="max-w-160 outline-hidden">
          {refusal ? (
            <FormNotice>{refusal.message}</FormNotice>
          ) : (
            changed &&
            (changed.saved ? (
              <FormNotice tone="success">
                {changed.restaurant.name} is back in your favorites.
              </FormNotice>
            ) : (
              <FormNotice tone="success">
                Removed {changed.restaurant.name} from your favorites.{" "}
                <Button
                  variant="link"
                  loading={changingSlug === changed.restaurant.slug}
                  onClick={() => onUndo(changed.restaurant)}
                >
                  Undo
                </Button>
              </FormNotice>
            ))
          )}
        </div>
      )}
      {content}
    </div>
  );
}
