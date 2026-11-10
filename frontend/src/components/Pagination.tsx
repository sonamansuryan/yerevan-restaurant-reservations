import type { ComponentProps, ReactElement } from "react";
import type { To } from "react-router";

import { LinkButton } from "@/components/Button";
import { cx } from "@/lib/cx";

interface PaginationProps extends ComponentProps<"nav"> {
  page: number;
  pageCount: number;
  /** Where a page lives. Pages are links, so one can open in a new tab, and Back returns. */
  hrefFor: (page: number) => To;
}

/**
 * Previous and Next around "Page 2 of 5", on a hairline, like the foot of a printed page. Nothing
 * shows when everything fits on one page.
 */
export function Pagination({
  page,
  pageCount,
  hrefFor,
  className,
  ...rest
}: PaginationProps): ReactElement | null {
  if (pageCount <= 1) return null;

  return (
    <nav
      aria-label="Pages"
      {...rest}
      className={cx(
        "grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-t border-line pt-4",
        className,
      )}
    >
      <div>
        {page > 1 && (
          <LinkButton variant="link" to={hrefFor(page - 1)} rel="prev">
            Previous
          </LinkButton>
        )}
      </div>
      <p className="text-ui text-ink-secondary">
        Page {page} of {pageCount}
      </p>
      <div className="text-right">
        {page < pageCount && (
          <LinkButton variant="link" to={hrefFor(page + 1)} rel="next">
            Next
          </LinkButton>
        )}
      </div>
    </nav>
  );
}
