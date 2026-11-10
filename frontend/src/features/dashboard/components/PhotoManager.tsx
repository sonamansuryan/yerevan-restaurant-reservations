import { useRef, useState } from "react";
import type { ChangeEvent, ReactElement } from "react";

import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { FormNotice } from "@/components/FormNotice";
import { Modal } from "@/components/Modal";
import { Spinner } from "@/components/Spinner";
import { MAX_PHOTOS, PHOTO_TYPES, photoProblem } from "@/features/dashboard/photos";
import { photoUrl } from "@/lib/images";
import type { ApiError } from "@/lib/api";
import type { OwnerPhoto } from "@/types/api";

interface PhotoManagerProps {
  photos: OwnerPhoto[];
  /** For the photos' alt text, such as "Lori Smokehouse, photo 2". */
  restaurantName: string;
  onUpload: (file: File) => void;
  uploading?: boolean;
  onMakeCover: (photoId: string) => void;
  onDelete: (photoId: string) => void;
  /** A cover or a delete is being sent. Every action waits until it's done. */
  busy?: boolean;
  /** What went wrong last: an upload, a cover or a delete. */
  error?: ApiError | null;
}

/**
 * The restaurant's photos, the cover first, as guests see them. A photo is added with one button,
 * which opens the device's own picker, and deleted only after a question, because that can't be
 * undone.
 */
export function PhotoManager({
  photos,
  restaurantName,
  onUpload,
  uploading = false,
  onMakeCover,
  onDelete,
  busy = false,
  error = null,
}: PhotoManagerProps): ReactElement {
  const input = useRef<HTMLInputElement>(null);
  // A file that failed the checks above. It's about the file just chosen, so it's local.
  const [problem, setProblem] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<OwnerPhoto | null>(null);
  const full = photos.length >= MAX_PHOTOS;
  const waiting = uploading || busy;

  function choose(): void {
    input.current?.click();
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    // Cleared, so choosing the same file again still counts as a change.
    event.target.value = "";
    if (!file) return;
    const found = photoProblem(file);
    setProblem(found);
    if (!found) onUpload(file);
  }

  function confirmDelete(): void {
    if (confirming) onDelete(confirming.id);
    setConfirming(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <p className="text-ui text-ink-secondary">
          {photos.length} of {MAX_PHOTOS} photos. The cover comes first, on your page and on Browse.
        </p>
        <Button variant="ghost" loading={uploading} disabled={full || busy} onClick={choose}>
          Add a photo
        </Button>
        {/* The real picker, opened by the button, so its look is ours. */}
        <input
          ref={input}
          type="file"
          accept={PHOTO_TYPES.join(",")}
          tabIndex={-1}
          aria-hidden="true"
          className="hidden"
          onChange={handleFile}
        />
      </div>
      {full && (
        <p className="text-meta text-ink-muted">
          A restaurant can have up to {MAX_PHOTOS} photos. Delete one to add another.
        </p>
      )}
      {(problem ?? error) && <FormNotice tone="error">{problem ?? error?.message}</FormNotice>}

      {photos.length === 0 && !uploading ? (
        <EmptyState
          title="No photos yet"
          description="The first photo you add becomes the cover."
          action={{ label: "Add a photo", onClick: choose }}
        />
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo, position) => {
            const name = photo.isCover ? "the cover" : `photo ${position + 1}`;
            return (
              <li key={photo.id} className="flex min-w-0 flex-col gap-1">
                <img
                  src={photoUrl(photo.url, 480)}
                  alt={`${restaurantName}, ${photo.isCover ? "cover photo" : `photo ${position + 1}`}`}
                  loading="lazy"
                  className="aspect-square w-full rounded-media bg-fill-slot object-cover"
                />
                <div className="flex flex-wrap items-center justify-between gap-x-4">
                  {photo.isCover ? (
                    <Badge tone="info" className="min-h-touch md:min-h-0">
                      Cover
                    </Badge>
                  ) : (
                    <Button
                      variant="link"
                      disabled={waiting}
                      aria-label={`Make cover, ${name}`}
                      onClick={() => onMakeCover(photo.id)}
                    >
                      Make cover
                    </Button>
                  )}
                  <Button
                    variant="link"
                    disabled={waiting}
                    aria-label={`Delete, ${name}`}
                    onClick={() => setConfirming(photo)}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            );
          })}
          {uploading && (
            <li className="grid aspect-square place-items-center rounded-media bg-fill-slot">
              <Spinner label="Uploading the photo" />
            </li>
          )}
        </ul>
      )}

      <Modal
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title="Delete this photo?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(null)}>
              Keep it
            </Button>
            <Button onClick={confirmDelete}>Delete photo</Button>
          </>
        }
      >
        {confirming?.isCover
          ? "It’s the cover, so the next photo becomes the cover. This can’t be undone."
          : "Guests won’t see it any more. This can’t be undone."}
      </Modal>
    </div>
  );
}
