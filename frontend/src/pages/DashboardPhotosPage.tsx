import type { ReactElement } from "react";

import { PartHeader } from "@/components/PartHeader";
import {
  DashboardLoadFailed,
  DashboardLoading,
} from "@/features/dashboard/components/DashboardStates";
import { PhotoManager } from "@/features/dashboard/components/PhotoManager";
import { useDashboardRestaurant } from "@/features/dashboard/hooks/useDashboardRestaurant";
import { usePhotoActions, usePhotos } from "@/features/dashboard/hooks/usePhotos";

/** A restaurant's photos: add, choose the cover, delete. */
export function DashboardPhotosPage(): ReactElement {
  const restaurant = useDashboardRestaurant();
  const photos = usePhotos(restaurant.id);
  const actions = usePhotoActions(restaurant.id);
  const retrying = photos.isFetching && photos.errorUpdateCount > 0;

  let body: ReactElement;
  if (photos.data) {
    body = (
      <PhotoManager
        photos={photos.data}
        restaurantName={restaurant.name}
        onUpload={actions.upload}
        uploading={actions.uploading}
        onMakeCover={actions.makeCover}
        onDelete={actions.remove}
        busy={actions.busy}
        error={actions.error}
      />
    );
  } else if (photos.isError || retrying) {
    body = (
      <DashboardLoadFailed
        what="the photos"
        onRetry={() => void photos.refetch()}
        retrying={retrying}
      />
    );
  } else {
    body = <DashboardLoading label="Loading the photos" />;
  }

  return (
    <>
      <title>{`Photos · ${restaurant.name} · Seghan`}</title>
      <PartHeader title="Photos" className="mb-6" />
      {body}
    </>
  );
}
