import type { ReactElement } from "react";

import { CardHeart } from "@/features/favorites/components/CardHeart";
import { useSaveRestaurant } from "@/features/favorites/hooks/useSaveRestaurant";

/**
 * A card's heart, wired: its own question to the server, the same one the restaurant's page asks,
 * so the two always agree. Owners and Seghan's team have no favorites, so for them it isn't there.
 * The pages pass it to the cards, which /design shows with CardHeart and sample states instead.
 */
export function RestaurantHeart({
  slug,
  name,
}: {
  slug: string;
  name: string;
}): ReactElement | null {
  const viewer = useSaveRestaurant(slug);
  return viewer && <CardHeart name={name} viewer={viewer} />;
}
