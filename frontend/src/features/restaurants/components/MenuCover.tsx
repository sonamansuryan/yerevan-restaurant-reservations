import type { ReactElement } from "react";

import { toneFor } from "@/features/restaurants/tones";
import { cx } from "@/lib/cx";

interface MenuCoverProps {
  name: string;
  /** Chooses the tone. */
  slug: string;
  className?: string;
}

/**
 * Stands in for a photo, like the cover of a menu: the restaurant's name, large, in serif on one of
 * the photo tones. It repeats the name that's already on the page, so screen readers skip it.
 */
export function MenuCover({ name, slug, className }: MenuCoverProps): ReactElement {
  return (
    <div
      aria-hidden="true"
      className={cx("flex items-center justify-center px-8 text-center", toneFor(slug), className)}
    >
      <p className="font-display text-section text-balance break-words text-on-dark">{name}</p>
    </div>
  );
}
