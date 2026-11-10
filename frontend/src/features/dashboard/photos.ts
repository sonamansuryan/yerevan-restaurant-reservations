/** The server's limit, which keeps a restaurant's page quick to load. */
export const MAX_PHOTOS = 10;

// What Cloudinary accepts for us (allowed_formats in the signed upload), and its free plan's limit
// for one image. Checked here first, so nobody waits for an upload that will be refused.
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

/** Why a chosen file can't be uploaded, or null if it can. */
export function photoProblem(file: File): string | null {
  if (!PHOTO_TYPES.includes(file.type)) return "Choose a JPG, PNG or WebP photo.";
  if (file.size > MAX_PHOTO_BYTES) return "Choose a photo under 10 MB.";
  return null;
}
