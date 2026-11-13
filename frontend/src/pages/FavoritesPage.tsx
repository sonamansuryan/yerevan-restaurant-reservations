import type { ReactElement } from "react";

import { PageContainer } from "@/components/PageContainer";
import { MyFavorites } from "@/features/favorites/components/MyFavorites";
import { useMyFavorites } from "@/features/favorites/hooks/useMyFavorites";

/** /favorites: the restaurants the signed-in guest saved. */
export function FavoritesPage(): ReactElement {
  const favorites = useMyFavorites();
  return (
    <PageContainer className="py-section-sm">
      <title>My favorites · Seghan</title>
      <h1 className="font-display text-section">My favorites</h1>
      <MyFavorites {...favorites} className="mt-8" />
    </PageContainer>
  );
}
