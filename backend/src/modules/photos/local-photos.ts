/**
 * Demo photos kept with the frontend, in frontend/public/demo-photos, rather than at Cloudinary: the
 * fictional restaurants' free Unsplash photos (npm run demo:photos). Their publicId starts with
 * this, so nothing ever asks Cloudinary about them.
 */
export const LOCAL_PHOTO_PREFIX = "local/demo-photos/";

/** Whether a photo is one of the local demo photos, rather than an upload at Cloudinary. */
export function isLocalPhoto(publicId: string): boolean {
  return publicId.startsWith(LOCAL_PHOTO_PREFIX);
}
