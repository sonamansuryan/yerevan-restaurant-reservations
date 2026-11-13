import { useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { cx } from "@/lib/cx";

interface RestaurantMapProps {
  /** The picture of its street, from our own API, or null when maps aren't set up: then no map. */
  src: string | null;
  /** Opens the restaurant in Google Maps, as the link under its address does. */
  mapsUrl: string;
  /** Shown instead when there's no map, or it couldn't load: the address, on the page. */
  fallback?: ReactNode;
  /** For /design: one moment held still, as loading, or as a map that couldn't load. */
  hold?: "loading" | "unavailable";
  className?: string;
}

/**
 * The map on a restaurant's page: its street from OpenStreetMap, drawn by Geoapify in a light,
 * quiet style, in a thin frame, with a wine pin at the place. The picture is centred on
 * the restaurant, so the dot sits at its middle. It's an extra: with no map set up, an address that
 * can't be found, or Geoapify failing, it's simply not there, and the address and the Google Maps
 * link under it do the job. Clicking it opens Google Maps. That link is left out for screen readers
 * and the keyboard, because the text link under the address is the same.
 */
export function RestaurantMap({
  src,
  mapsUrl,
  fallback,
  hold,
  className,
}: RestaurantMapProps): ReactElement | null {
  const [shown, setShown] = useState(false);
  const [failed, setFailed] = useState(false);

  if (hold === "unavailable") return <>{fallback}</>;
  // Held as loading, the frame shows with or without a picture: only the picture is held back.
  if (hold !== "loading" && (!src || failed)) return <>{fallback}</>;
  const waiting = hold === "loading" || !shown;

  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      tabIndex={-1}
      aria-hidden="true"
      className={cx(
        "relative block aspect-8/5 overflow-hidden rounded-band border border-line bg-surface-tinted",
        className,
      )}
    >
      {hold !== "loading" && src && (
        // The paper tint holds the place, so nothing moves when the picture arrives, then it fades in.
        <img
          src={src}
          alt=""
          width={640}
          height={400}
          loading="lazy"
          decoding="async"
          onLoad={() => setShown(true)}
          onError={() => setFailed(true)}
          className={cx(
            "size-full object-cover transition-opacity duration-300 motion-reduce:transition-none",
            waiting ? "opacity-0" : "opacity-100",
          )}
        />
      )}
      {!waiting && (
        // The place: a wine pin, ringed in white so it reads on any street, its point on the spot.
        <span className="absolute top-1/2 left-1/2 size-9 -translate-x-1/2 -translate-y-full">
          <span className="block size-full -rotate-45 rounded-[999px_999px_999px_0] border-3 border-surface-raised bg-accent shadow-float" />
        </span>
      )}
    </a>
  );
}
