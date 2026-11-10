// Restaurant photos at Cloudinary, which stores them, resizes them for each screen and serves them.
// This is the only code that talks to Cloudinary, so tests replace it. Only deleting goes over the
// network: signing and checking signatures are calculations with our API secret.
import { randomUUID, timingSafeEqual } from "node:crypto";

import { v2 as cloudinary } from "cloudinary";

import { env } from "../../config/env.ts";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

/** The formats an owner can upload. Cloudinary refuses anything else. */
const ALLOWED_FORMATS = "jpg,jpeg,png,webp";

/** Where one restaurant's photos live at Cloudinary. A photo can only be saved from its own. */
export function photoFolder(restaurantId: string): string {
  return `seghan/restaurants/${restaurantId}`;
}

/** Permission for one upload, straight from the browser to Cloudinary. */
export interface UploadPermission {
  /** Where the browser sends the photo, as multipart form data. */
  url: string;
  /** Sent with the file exactly as they are, because the signature covers them. */
  fields: Record<string, string>;
}

/**
 * Signs permission for one photo upload. Cloudinary accepts it for an hour from `timestamp`, for
 * this exact name in this restaurant's folder, and for images in the allowed formats only. The API
 * secret signs it and never leaves the server. The API key travels with it, but it isn't a secret.
 */
export function signUpload(restaurantId: string): UploadPermission {
  const signed = {
    allowed_formats: ALLOWED_FORMATS,
    // A new random name each time, so an upload can never replace an existing photo.
    public_id: `${photoFolder(restaurantId)}/${randomUUID()}`,
    timestamp: String(Math.floor(Date.now() / 1000)),
  };
  return {
    url: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    fields: {
      ...signed,
      api_key: env.CLOUDINARY_API_KEY,
      signature: cloudinary.utils.api_sign_request(signed, env.CLOUDINARY_API_SECRET),
    },
  };
}

/** What Cloudinary answers after an upload, as the browser passes it on. */
export interface UploadReply {
  publicId: string;
  version: number;
  signature: string;
}

/**
 * Whether Cloudinary itself sent this reply. Cloudinary signs a reply's `public_id` and `version`
 * with our API secret, so a made-up or altered reply doesn't match.
 */
export function isGenuineUpload({ publicId, version, signature }: UploadReply): boolean {
  const expected = Buffer.from(
    cloudinary.utils.api_sign_request({ public_id: publicId, version }, env.CLOUDINARY_API_SECRET),
  );
  const given = Buffer.from(signature);
  // Compared in constant time, so how long the check takes gives nothing away.
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/**
 * A photo's address at Cloudinary, built here from its name and version, never taken from the
 * browser. Built by hand rather than with cloudinary.url(), which adds a tracking parameter
 * (?_a=…) to every address. The frontend's photoUrl() adds the size and format to this address.
 */
export function photoAddress(publicId: string, version: number): string {
  return `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/v${version}/${publicId}`;
}

/** Deletes a photo at Cloudinary. This is the one call here that goes over the network. */
export async function deleteUpload(publicId: string): Promise<void> {
  const reply: unknown = await cloudinary.uploader.destroy(publicId, {
    invalidate: true,
    resource_type: "image",
  });
  const outcome =
    typeof reply === "object" && reply !== null && "result" in reply ? reply.result : null;
  // "not found" means it's already gone, which is fine too.
  if (outcome !== "ok" && outcome !== "not found") {
    throw new Error(`Cloudinary didn't delete the photo (${String(outcome)})`);
  }
}
