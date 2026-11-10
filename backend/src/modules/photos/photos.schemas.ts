import { z } from "zod";

/** /photos/:photoId. Photo ids are UUIDs, so anything else is refused before the database is asked. */
export const photoIdSchema = z.object({
  photoId: z.uuid({ error: "Choose a photo." }),
});

const UPLOAD = "Upload the photo again.";

/**
 * POST /photos: what Cloudinary answered after the upload, passed on by the browser. These rules
 * only check its shape. The service then proves Cloudinary really sent it, for this restaurant.
 */
export const savePhotoSchema = z.object({
  // The name our upload permission gave it: seghan/restaurants/<restaurant id>/<random id>.
  publicId: z
    .string({ error: UPLOAD })
    .regex(/^seghan\/restaurants\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/, UPLOAD),
  version: z.number({ error: UPLOAD }).int(UPLOAD).positive(UPLOAD),
  // Cloudinary's signature: SHA-1 or SHA-256, in hex.
  signature: z.string({ error: UPLOAD }).regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/, UPLOAD),
});

/**
 * PATCH /photos/:photoId: make this photo the cover. A restaurant with photos always has one cover,
 * so a cover can be moved to another photo but never removed.
 */
export const coverSchema = z.object({
  isCover: z.literal(true, { error: "Choose a photo as the cover." }),
});

export type PhotoIdParams = z.infer<typeof photoIdSchema>;
export type SavePhotoInput = z.infer<typeof savePhotoSchema>;
