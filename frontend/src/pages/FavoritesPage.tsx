import type { ReactElement } from "react";

import { PageContainer } from "@/components/PageContainer";
import { MyFavorites } from "@/features/favorites/components/MyFavorites";
import { useMyFavorites } from "@/features/favorites/hooks/useMyFavorites";

/** /favorites: the restaurants the signed-in guest saved. */
export function FavoritesPage(): ReactElement {
  const favorites = useMyFavorites();
  return (
    <PageContainer className="pt-10 pb-section-sm md:pt-14">
      <title>My favorites · Seghan</title>
      <h1 className="font-grotesque text-page-title font-bold">My favorites</h1>
      <MyFavorites {...favorites} className="mt-8" />
    </PageContainer>
  );
}
