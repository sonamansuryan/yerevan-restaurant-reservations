import { afterEach, expect, test, vi } from "vitest";
import type { Mock } from "vitest";

import { UPLOAD_FAILED, uploadPhoto } from "@/features/dashboard/hooks/usePhotos";

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status });

const CLOUDINARY = "https://api.cloudinary.com/v1_1/test-cloud/image/upload";
const PUBLIC_ID = "seghan/restaurants/r-1/1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
// Fake values in the shape the API sends: never a real key or signature.
const permission = {
  upload: {
    url: CLOUDINARY,
    fields: {
      allowed_formats: "jpg,jpeg,png,webp",
      public_id: PUBLIC_ID,
      timestamp: "1731240000",
      api_key: "000000000000000",
      signature: "s".repeat(40),
    },
  },
};
const saved = {
  photos: [
    {
      id: "photo-1",
      url: `https://res.cloudinary.com/test-cloud/image/upload/v1731240000/${PUBLIC_ID}`,
      isCover: true,
      sortOrder: 0,
    },
  ],
};

/** Our API signs and saves. Cloudinary answers as told: a reply, or no connection at all. */
function fakeFetch(cloudinary: Response | Error): Mock {
  const fetch = vi.fn((url: string) => {
    if (url === "/api/owner/restaurants/r-1/photos/signature") {
      return Promise.resolve(json(permission));
    }
    if (url === CLOUDINARY) {
      return cloudinary instanceof Error ? Promise.reject(cloudinary) : Promise.resolve(cloudinary);
    }
    if (url === "/api/owner/restaurants/r-1/photos") return Promise.resolve(json(saved, 201));
    return Promise.reject(new Error(`Unexpected request to ${url}`));
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const file = new File(["a photo"], "lori.jpg", { type: "image/jpeg" });

afterEach(() => {
  vi.unstubAllGlobals();
});

test("the photo goes straight to Cloudinary with the signed fields, then its answer is saved", async () => {
  const fetch = fakeFetch(
    json({ public_id: PUBLIC_ID, version: 1731240001, signature: "a".repeat(40), bytes: 7 }),
  );

  await expect(uploadPhoto("r-1", file)).resolves.toEqual(saved.photos);

  type Call = [string, RequestInit];
  expect(fetch).toHaveBeenCalledTimes(3);
  const [signing, upload, saving] = fetch.mock.calls as unknown as [Call, Call, Call];
  expect(signing[0]).toBe("/api/owner/restaurants/r-1/photos/signature");
  // Every signed field exactly as sent, and the file. No cookies go to Cloudinary.
  const form = upload[1].body as FormData;
  for (const [name, value] of Object.entries(permission.upload.fields)) {
    expect(form.get(name)).toBe(value);
  }
  expect(form.get("file")).toBeInstanceOf(File);
  expect(upload[1]).toEqual({ method: "POST", body: form });
  // Only Cloudinary's three answers are passed on, never anything else it said.
  expect(JSON.parse(String(saving[1].body))).toEqual({
    publicId: PUBLIC_ID,
    version: 1731240001,
    signature: "a".repeat(40),
  });
});

test("if Cloudinary refuses the photo, nothing is saved, and it says so plainly", async () => {
  const fetch = fakeFetch(json({ error: { message: "Invalid image file" } }, 400));

  await expect(uploadPhoto("r-1", file)).rejects.toMatchObject({
    code: "UPLOAD_FAILED",
    message: UPLOAD_FAILED,
  });
  expect(fetch).toHaveBeenCalledTimes(2);
});

test("so does no connection to Cloudinary", async () => {
  const fetch = fakeFetch(new TypeError("Failed to fetch"));

  await expect(uploadPhoto("r-1", file)).rejects.toMatchObject({ code: "UPLOAD_FAILED" });
  expect(fetch).toHaveBeenCalledTimes(2);
});
