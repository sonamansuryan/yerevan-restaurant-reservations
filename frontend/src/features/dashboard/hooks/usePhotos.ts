import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient, UseMutationResult, UseQueryResult } from "@tanstack/react-query";

import { ownerKeys, ownerRestaurantPath } from "@/features/dashboard/queryKeys";
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import type { OwnerPhoto, OwnerPhotosResponse, PhotoUploadResponse } from "@/types/api";

export const UPLOAD_FAILED = "The photo didn’t upload. Please try again.";

/** A restaurant's photos, the cover first. */
export function usePhotos(id: string): UseQueryResult<OwnerPhoto[], ApiError> {
  return useQuery<OwnerPhoto[], ApiError>({
    queryKey: ownerKeys.photos(id),
    queryFn: async () =>
      (await apiGet<OwnerPhotosResponse>(`${ownerRestaurantPath(id)}/photos`)).photos,
  });
}

function isCloudinaryReply(
  reply: unknown,
): reply is { public_id: string; version: number; signature: string } {
  return (
    typeof reply === "object" &&
    reply !== null &&
    "public_id" in reply &&
    typeof reply.public_id === "string" &&
    "version" in reply &&
    typeof reply.version === "number" &&
    "signature" in reply &&
    typeof reply.signature === "string"
  );
}

/**
 * The three steps of an upload (task 4.4): our server signs a permission, the photo goes straight
 * to Cloudinary with it, and our server saves Cloudinary's answer once it has checked it. The middle
 * step is the one request that doesn't go through lib/api.ts, because it isn't to our API: the
 * rules allow it for Cloudinary uploads our server has signed.
 */
export async function uploadPhoto(id: string, file: File): Promise<OwnerPhoto[]> {
  const photos = `${ownerRestaurantPath(id)}/photos`;
  const { upload } = await apiPost<PhotoUploadResponse>(`${photos}/signature`);

  const form = new FormData();
  for (const [name, value] of Object.entries(upload.fields)) form.append(name, value);
  form.append("file", file);
  let reply: unknown;
  try {
    const response = await fetch(upload.url, { method: "POST", body: form });
    reply = response.ok ? await response.json() : null;
  } catch {
    reply = null;
  }
  if (!isCloudinaryReply(reply)) throw new ApiError(0, "UPLOAD_FAILED", UPLOAD_FAILED);

  const { public_id: publicId, version, signature } = reply;
  return (await apiPost<OwnerPhotosResponse>(photos, { publicId, version, signature })).photos;
}

/**
 * Every change answers with the photos as they now are, so they're shown at once. The pages guests
 * see show the cover too, so they're fetched again the next time they're needed.
 */
function remember(queryClient: QueryClient, id: string, photos: OwnerPhoto[]): void {
  queryClient.setQueryData(ownerKeys.photos(id), photos);
  void queryClient.invalidateQueries({ queryKey: ["restaurants"] });
  void queryClient.invalidateQueries({ queryKey: ["restaurant"] });
}

export function useUploadPhoto(id: string): UseMutationResult<OwnerPhoto[], ApiError, File> {
  const queryClient = useQueryClient();
  return useMutation<OwnerPhoto[], ApiError, File>({
    mutationFn: (file) => uploadPhoto(id, file),
    onSuccess: (photos) => remember(queryClient, id, photos),
  });
}

export function useMakeCover(id: string): UseMutationResult<OwnerPhoto[], ApiError, string> {
  const queryClient = useQueryClient();
  return useMutation<OwnerPhoto[], ApiError, string>({
    mutationFn: async (photoId) =>
      (
        await apiPatch<OwnerPhotosResponse>(
          `${ownerRestaurantPath(id)}/photos/${encodeURIComponent(photoId)}`,
          { isCover: true },
        )
      ).photos,
    onSuccess: (photos) => remember(queryClient, id, photos),
  });
}

/** What the photos page can do, with one place for what's happening and what went wrong. */
export interface PhotoActions {
  upload: (file: File) => void;
  makeCover: (photoId: string) => void;
  remove: (photoId: string) => void;
  uploading: boolean;
  /** A cover or a delete is being sent. */
  busy: boolean;
  /** What went wrong with the latest action, if it failed. */
  error: ApiError | null;
}

export function usePhotoActions(id: string): PhotoActions {
  const upload = useUploadPhoto(id);
  const cover = useMakeCover(id);
  const deletion = useDeletePhoto(id);
  // Starting an action clears the others' old errors, so only the latest one is ever shown.
  function start(): void {
    upload.reset();
    cover.reset();
    deletion.reset();
  }
  return {
    upload: (file) => {
      start();
      upload.mutate(file);
    },
    makeCover: (photoId) => {
      start();
      cover.mutate(photoId);
    },
    remove: (photoId) => {
      start();
      deletion.mutate(photoId);
    },
    uploading: upload.isPending,
    busy: cover.isPending || deletion.isPending,
    error: upload.error ?? cover.error ?? deletion.error,
  };
}

export function useDeletePhoto(id: string): UseMutationResult<OwnerPhoto[], ApiError, string> {
  const queryClient = useQueryClient();
  return useMutation<OwnerPhoto[], ApiError, string>({
    mutationFn: async (photoId) =>
      (
        await apiDelete<OwnerPhotosResponse>(
          `${ownerRestaurantPath(id)}/photos/${encodeURIComponent(photoId)}`,
        )
      ).photos,
    onSuccess: (photos) => remember(queryClient, id, photos),
  });
}
