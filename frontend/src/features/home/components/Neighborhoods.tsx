import type { ReactElement } from "react";
import { Link } from "react-router";

import { restaurantsWords } from "@/features/home/home";
import { toneAt } from "@/features/restaurants/tones";
import { cx } from "@/lib/cx";

export interface Area {
  /** Browse, filtered to the district. */
  to: string;
  label: string;
  /** How many restaurants it has, once counted. */
  count?: number;
}

/**
 * The home page's districts as tiles, each in its own tone, each opening Browse filtered to it. The
 * count shows once it has come. Until then, or if it can't, the name stands alone, and a blank
 * line keeps the tile's height.
 */
export function Neighborhoods({
  areas,
  className,
}: {
  areas: Area[];
  className?: string;
}): ReactElement {
  return (
    <ul
      className={cx(
        "grid grid-cols-[repeat(auto-fill,minmax(min(12.5rem,calc(50%-0.5rem)),1fr))] gap-4",
        className,
      )}
    >
      {areas.map((area, index) => (
        <li key={area.to}>
          <Link
            to={area.to}
            className={cx(
              "group flex h-35 flex-col justify-end gap-0.5 rounded-band p-4 text-on-dark",
              toneAt(index),
            )}
          >
            <span className="font-grotesque text-title-sm font-bold underline decoration-transparent underline-offset-4 transition-[text-decoration-color] duration-button group-hover:decoration-on-dark">
              {area.label}
            </span>{" "}
            {/* The space keeps "Kentron" and "13 restaurants" apart for screen readers. */}
            <span className="text-meta">
              {area.count === undefined ? " " : restaurantsWords(area.count)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
