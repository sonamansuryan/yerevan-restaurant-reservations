import type { ReactElement } from "react";
import { Link } from "react-router";

import { HeartIcon } from "@/components/icons";
import type { SaveViewer } from "@/features/favorites/components/SaveRestaurant";
import { cx } from "@/lib/cx";

// A white circle on the photo, as on the export's cards: 36px, and 44px wherever there's a touch
// screen, to tap.
const circle =
  "grid size-9 place-items-center rounded-pill bg-surface-raised text-ink shadow-tab transition-[color,background-color] duration-button hover:text-accent any-pointer-coarse:size-11";

/**
 * Saving a restaurant from its card: a heart on its photo. Signed out, it asks to sign in first, and
 * comes back to the same page. A guest's heart fills in wine once it's saved. While the change is
 * sent, a ring turns in its place. If the change fails, the heart stays as it was and screen readers
 * hear why.
 */
export function CardHeart({ name, viewer }: { name: string; viewer: SaveViewer }): ReactElement {
  if (viewer.kind === "signedOut") {
    return (
      <Link
        to="/login"
        state={viewer.signIn}
        aria-label={`Sign in to save ${name}`}
        className={circle}
      >
        <HeartIcon width="18" height="18" />
      </Link>
    );
  }

  const saved = viewer.saved ?? false;
  // Until the answer comes, the ring turns, so the heart never shows the wrong state.
  const loading = viewer.saving || viewer.saved === undefined;
  return (
    <>
      <button
        type="button"
        aria-label={`${saved ? "Saved" : "Save"} ${name}`}
        aria-pressed={saved}
        aria-busy={loading || undefined}
        aria-disabled={loading || undefined}
        onClick={loading ? undefined : viewer.onToggle}
        className={cx(circle, saved && "text-accent", loading && "cursor-progress")}
      >
        {loading ? (
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-pill border-[1.5px] border-current border-r-transparent motion-reduce:[animation-duration:3s]"
          />
        ) : (
          <HeartIcon width="18" height="18" fill={saved ? "currentColor" : "none"} />
        )}
      </button>
      {viewer.error && (
        <span role="alert" className="sr-only">
          {viewer.error.message}
        </span>
      )}
    </>
  );
}
