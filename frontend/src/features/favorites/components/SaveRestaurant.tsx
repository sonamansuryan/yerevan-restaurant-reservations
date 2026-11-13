import type { ReactElement } from "react";

import { LinkButton } from "@/components/Button";
import { SaveButton } from "@/components/SaveButton";
import type { ReturnState } from "@/features/auth/returnTo";
import type { ApiError } from "@/lib/api";
import { cx } from "@/lib/cx";

/**
 * Who's looking, for saving: someone signed out is offered Sign in to save, and comes back to the
 * page afterwards; a guest gets the toggle. Owners and admins have no favorites, so it isn't there.
 */
export type SaveViewer =
  | { kind: "signedOut"; signIn: ReturnState }
  | {
      kind: "guest";
      /** Whether it's saved, or undefined until the answer comes. */
      saved: boolean | undefined;
      /** True while a save or unsave is sent. */
      saving: boolean;
      /** Why the last change was refused, or couldn't be sent. */
      error: ApiError | null;
      onToggle: () => void;
    };

interface SaveRestaurantProps {
  /** The restaurant's name, read out with the toggle. */
  name: string;
  viewer: SaveViewer;
  className?: string;
}

/** Saving a restaurant from its page, at the top beside the way back to all restaurants. */
export function SaveRestaurant({ name, viewer, className }: SaveRestaurantProps): ReactElement {
  if (viewer.kind === "signedOut") {
    return (
      <LinkButton variant="link" to="/login" state={viewer.signIn} className={className}>
        Sign in to save
      </LinkButton>
    );
  }
  return (
    <div className={cx("flex flex-col items-end", className)}>
      <SaveButton
        saved={viewer.saved ?? false}
        name={name}
        // Until the answer comes, the ring turns, so the toggle never shows the wrong state.
        loading={viewer.saving || viewer.saved === undefined}
        onClick={viewer.onToggle}
      />
      {viewer.error && (
        <p role="alert" className="max-w-80 text-right text-meta text-ink-secondary">
          {viewer.error.message}
        </p>
      )}
    </div>
  );
}
