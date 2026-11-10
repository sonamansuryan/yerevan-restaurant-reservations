// The Cloudinary integration (src/integrations/cloudinary/photos.ts) with the real Cloudinary library
// and the fake settings from vitest.config.ts. Signing and checking are calculations, so they run
// for real. Only deleting goes over the network, and that call is replaced.
import { v2 as cloudinary } from "cloudinary";
import { afterEach, describe, expect, test, vi } from "vitest";

import { env } from "../src/config/env.ts";
import {
  deleteUpload,
  isGenuineUpload,
  photoAddress,
  signUpload,
} from "../src/integrations/cloudinary/photos.ts";
import { ownedRow } from "./fixtures/restaurants.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

const RESTAURANT = ownedRow().id;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/;

/** Cloudinary's reply after an upload, signed the way Cloudinary signs it. */
function cloudinaryReply(publicId: string, version = 1731240000) {
  const signature = cloudinary.utils.api_sign_request(
    { public_id: publicId, version },
    env.CLOUDINARY_API_SECRET,
  );
  return { publicId, version, signature };
}

describe("signUpload", () => {
  test("signs exactly what the browser sends: the formats, a new name and the time", () => {
    const before = Math.floor(Date.now() / 1000);
    const { url, fields } = signUpload(RESTAURANT);

    expect(url).toBe("https://api.cloudinary.com/v1_1/test-cloud/image/upload");
    expect(Object.keys(fields).sort()).toEqual([
      "allowed_formats",
      "api_key",
      "public_id",
      "signature",
      "timestamp",
    ]);
    expect(fields["allowed_formats"]).toBe("jpg,jpeg,png,webp");
    expect(fields["public_id"]).toMatch(
      new RegExp(`^seghan/restaurants/${RESTAURANT}/${UUID.source}$`),
    );
    expect(Number(fields["timestamp"])).toBeGreaterThanOrEqual(before);
    const { signature, api_key: _apiKey, ...signed } = fields;
    expect(signature).toBe(cloudinary.utils.api_sign_request(signed, env.CLOUDINARY_API_SECRET));
  });

  test("the secret never leaves the server: only the API key goes to the browser", () => {
    const { url, fields } = signUpload(RESTAURANT);

    expect(fields["api_key"]).toBe(env.CLOUDINARY_API_KEY);
    expect(JSON.stringify({ url, fields })).not.toContain(env.CLOUDINARY_API_SECRET);
  });

  test("every permission names a new photo, so no upload can replace another", () => {
    expect(signUpload(RESTAURANT).fields["public_id"]).not.toBe(
      signUpload(RESTAURANT).fields["public_id"],
    );
  });
});

describe("isGenuineUpload", () => {
  const name = `seghan/restaurants/${RESTAURANT}/0f9c1d2e-3b4a-4c5d-8e6f-7a8b9c0d1e2f`;

  test("a reply Cloudinary signed is genuine", () => {
    expect(isGenuineUpload(cloudinaryReply(name))).toBe(true);
  });

  test("a reply with anything changed isn't", () => {
    const reply = cloudinaryReply(name);

    expect(isGenuineUpload({ ...reply, version: reply.version + 1 })).toBe(false);
    expect(isGenuineUpload({ ...reply, publicId: `${name}0` })).toBe(false);
    expect(isGenuineUpload({ ...reply, signature: "0".repeat(40) })).toBe(false);
    // A signature of the wrong length is a plain "no", never an error.
    expect(isGenuineUpload({ ...reply, signature: "abc" })).toBe(false);
  });

  test("a reply signed with another secret isn't", () => {
    const signature = cloudinary.utils.api_sign_request(
      { public_id: name, version: 1 },
      "someone-elses-secret",
    );

    expect(isGenuineUpload({ publicId: name, version: 1, signature })).toBe(false);
  });
});

test("photoAddress builds the photo's address from its name and version, and nothing else", () => {
  expect(photoAddress(`seghan/restaurants/${RESTAURANT}/abc`, 1731240000)).toBe(
    `https://res.cloudinary.com/test-cloud/image/upload/v1731240000/seghan/restaurants/${RESTAURANT}/abc`,
  );
});

describe("deleteUpload", () => {
  test("asks Cloudinary to delete the image, and to stop serving copies of it", async () => {
    const destroy = vi.spyOn(cloudinary.uploader, "destroy").mockResolvedValue({ result: "ok" });

    await deleteUpload("seghan/restaurants/x/y");

    expect(destroy).toHaveBeenCalledWith("seghan/restaurants/x/y", {
      invalidate: true,
      resource_type: "image",
    });
  });

  test("an image that's already gone is fine", async () => {
    vi.spyOn(cloudinary.uploader, "destroy").mockResolvedValue({ result: "not found" });

    await expect(deleteUpload("seghan/restaurants/x/y")).resolves.toBeUndefined();
  });

  test("any other answer, or no answer, is an error", async () => {
    const destroy = vi.spyOn(cloudinary.uploader, "destroy");

    destroy.mockResolvedValueOnce({ result: "error" });
    await expect(deleteUpload("seghan/restaurants/x/y")).rejects.toThrow("didn't delete");
    destroy.mockRejectedValueOnce(new Error("network down"));
    await expect(deleteUpload("seghan/restaurants/x/y")).rejects.toThrow("network down");
  });
});
