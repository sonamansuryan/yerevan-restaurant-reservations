import type { ReactElement } from "react";

import { MenuCover } from "@/features/restaurants/components/MenuCover";
import { cx } from "@/lib/cx";
import { photoUrl } from "@/lib/images";

/** How many photos sit beside the cover. Any others follow lower on the page (RestaurantDetails). */
export const BESIDE_COVER = 4;

// How the photos beside the cover share its height from 1024px, by how many there are: one fills
// the space, two lie one above the other, three put the first beside two stacked, four make a
// square. Tailwind needs every class written out in full, so they're listed rather than built.
const SPANS: Record<number, string[]> = {
  1: ["lg:col-span-2 lg:row-span-2"],
  2: ["lg:col-span-2", "lg:col-span-2"],
  3: ["lg:row-span-2", "", ""],
  4: ["", "", "", ""],
};

interface RestaurantPhotosProps {
  name: string;
  /** Chooses the menu cover's tone, with no photo. */
  slug: string;
  /** The cover photo, or null when there's no photo: then a menu cover stands in. */
  cover: string | null;
  /** The photos to set beside the cover, at most BESIDE_COVER. */
  beside: string[];
  /** Shows the cover whole, on the paper tint, instead of cropping it (covers.ts). */
  whole: boolean;
}

/**
 * A restaurant's photos at the top of its page. From 1024px, as the export has them, the cover takes
 * half the width and the others share the rest, in one frame 368px tall with rounded corners. On a
 * phone the cover runs from edge to edge, 300px tall, with the page rising over its foot as a sheet
 * (RestaurantDetails), and the other photos wait further down the page. With no other photo, the
 * cover is a wide banner; with no photo at all, the menu cover stands in, as a short band. All are
 * decorative until owners can describe their photos: the name follows at once.
 */
export function RestaurantPhotos({
  name,
  slug,
  cover,
  beside,
  whole,
}: RestaurantPhotosProps): ReactElement {
  // A short band: the name follows at once, so a tall one would only push booking down the page.
  if (!cover) {
    return (
      <MenuCover
        name={name}
        slug={slug}
        className="h-60 max-lg:-mx-gutter-sm max-lg:pb-15 lg:rounded-sheet"
      />
    );
  }

  const alone = beside.length === 0;
  const coverPhoto = (
    <img
      src={photoUrl(cover, 1600)}
      srcSet={`${photoUrl(cover, 800)} 800w, ${photoUrl(cover, 1600)} 1600w`}
      sizes={alone ? "(min-width: 1344px) 1280px, 100vw" : "(min-width: 1024px) 50vw, 100vw"}
      alt=""
      className={cx("size-full", whole ? "bg-surface-tinted object-contain" : "object-cover")}
    />
  );

  if (alone) {
    return (
      <div className="h-75 overflow-hidden max-lg:-mx-gutter-sm lg:aspect-21/9 lg:h-auto lg:rounded-sheet">
        {coverPhoto}
      </div>
    );
  }

  // From 1024px the photos share one frame, whose corners round the outside of the whole set, as the
  // photos of one place. On a phone only the cover shows here.
  return (
    <div className="max-lg:-mx-gutter-sm lg:grid lg:h-92 lg:grid-cols-[2fr_1fr_1fr] lg:grid-rows-2 lg:gap-2 lg:overflow-hidden lg:rounded-sheet">
      <div className="h-75 overflow-hidden lg:row-span-2 lg:h-auto">{coverPhoto}</div>
      {beside.map((url, index) => (
        <div
          key={url}
          className={cx("overflow-hidden max-lg:hidden", SPANS[beside.length]?.[index])}
        >
          <img src={photoUrl(url, 600)} alt="" loading="lazy" className="size-full object-cover" />
        </div>
      ))}
    </div>
  );
}
