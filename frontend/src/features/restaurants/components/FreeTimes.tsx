import type { ReactElement } from "react";
import { Link } from "react-router";
import type { To } from "react-router";

import { LinkButton } from "@/components/Button";
import { cx } from "@/lib/cx";

/** A card's times: still loading, couldn't load, or the times themselves, which may be none. */
export type FreeTimesState =
  { status: "loading" } | { status: "failed" } | { status: "ready"; times: string[] };

interface FreeTimesProps {
  /** The restaurant's name, which each time's spoken label includes. */
  name: string;
  state: FreeTimesState;
  /** When the times are, in words: "tonight", or "on Saturday 14 November". */
  when: string;
  /** Where a time opens: the restaurant's page with the booking already at that time. */
  linkFor: (time: string) => To;
  /** Where to choose another time or day: the restaurant's page. */
  pageLink: To;
}

// Small wine chips, as on the export's cards. Each is the card's way to book, so it's wine, like the
// booking's chosen time. They're 32px tall, and 44px wherever there's a touch screen, to tap.
const chip =
  "inline-flex min-h-8 min-w-15 items-center justify-center rounded-chip px-3 text-meta font-semibold tabular-nums any-pointer-coarse:min-h-touch";

/**
 * A restaurant's first free times for a card, each opening its page with the booking already at
 * that time. While they load, three blanks hold their place, so the card keeps its height. With none
 * left, or none loaded, a link to all its times takes their place.
 */
export function FreeTimes({ name, state, when, linkFor, pageLink }: FreeTimesProps): ReactElement {
  if (state.status === "loading") {
    return (
      <div role="status" className="flex gap-1.5">
        <span className="sr-only">Finding free tables at {name}</span>
        {[0, 1, 2].map((blank) => (
          <span key={blank} aria-hidden="true" className={cx(chip, "bg-fill-slot")} />
        ))}
      </div>
    );
  }

  if (state.status === "failed" || state.times.length === 0) {
    return (
      <p className="flex min-h-8 flex-wrap items-center gap-x-3 text-meta text-ink-secondary any-pointer-coarse:min-h-touch">
        {state.status === "failed" ? "Couldn’t load the times." : `No tables free ${when}.`}
        <LinkButton variant="link" to={pageLink} className="text-meta">
          {state.status === "failed" ? "See its times" : "Choose another time"}
        </LinkButton>
      </p>
    );
  }

  return (
    <ul aria-label={`Free ${when} at ${name}`} className="flex flex-wrap gap-1.5">
      {state.times.map((starts) => (
        <li key={starts}>
          <Link
            to={linkFor(starts)}
            aria-label={`Book ${name} ${when} at ${starts}`}
            className={cx(
              chip,
              "bg-accent text-on-accent transition-[background-color] duration-button hover:bg-accent-hover",
            )}
          >
            {starts}
          </Link>
        </li>
      ))}
    </ul>
  );
}
