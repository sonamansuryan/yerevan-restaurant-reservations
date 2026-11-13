// Copies a photo from Wikimedia Commons into our Cloudinary account, for the demo listings' import
// (PROJECT_PLAN.md 9.7). Cloudinary fetches it from the address itself. Each copy has a fixed name,
// and an existing one is never replaced, so importing again copies nothing twice. Kept apart from
// photos.ts, which owners' uploads use, so tests can replace this alone.
import { v2 as cloudinary } from "cloudinary";

// Imported for its configuration of the Cloudinary client, as well as the address it builds.
import { photoAddress } from "./photos.ts";

/** A copy at Cloudinary, ready to save as a RestaurantPhoto. */
export interface CopiedPhoto {
  publicId: string;
  url: string;
}

/** Copies the photo at `sourceUrl` to Cloudinary as `publicId`, or finds the copy made before. */
export async function copyPhoto(sourceUrl: string, publicId: string): Promise<CopiedPhoto> {
  const reply: unknown = await cloudinary.uploader.upload(sourceUrl, {
    public_id: publicId,
    overwrite: false,
    resource_type: "image",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  });
  const { public_id: savedId, version } = (reply ?? {}) as {
    public_id?: unknown;
    version?: unknown;
  };
  if (savedId !== publicId || typeof version !== "number") {
    throw new Error(`Cloudinary didn't copy the photo as ${publicId}`);
  }
  return { publicId, url: photoAddress(publicId, version) };
}
