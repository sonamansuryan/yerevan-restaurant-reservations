// Copying a photo into Cloudinary (src/integrations/cloudinary/remote-photos.ts, task 9.7), with the
// Cloudinary library's upload replaced: a fixed name, never replacing a copy made before, and the
// address built from what Cloudinary answers. Every other test replaces this module.
import { v2 as cloudinary } from "cloudinary";
import { afterEach, expect, test, vi } from "vitest";

vi.unmock("../src/integrations/cloudinary/remote-photos.ts");

const { copyPhoto } = await import("../src/integrations/cloudinary/remote-photos.ts");

afterEach(() => {
  vi.restoreAllMocks();
});

const SOURCE = "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/1920px-Dolmama.jpg";
const NAME = "seghan/demo-listings/node-6566646015/0123456789abcdef";

test("Cloudinary fetches the photo itself, under its fixed name, never replacing one already there", async () => {
  const upload = vi
    .spyOn(cloudinary.uploader, "upload")
    .mockResolvedValue({ public_id: NAME, version: 1731240000 } as never);

  const copy = await copyPhoto(SOURCE, NAME);

  expect(upload).toHaveBeenCalledWith(SOURCE, {
    public_id: NAME,
    overwrite: false,
    resource_type: "image",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  });
  expect(copy).toEqual({
    publicId: NAME,
    url: `https://res.cloudinary.com/test-cloud/image/upload/v1731240000/${NAME}`,
  });
});

test("an answer for another name, or without a version, isn't taken as a copy", async () => {
  vi.spyOn(cloudinary.uploader, "upload").mockResolvedValueOnce({
    public_id: "seghan/other",
    version: 1,
  } as never);
  await expect(copyPhoto(SOURCE, NAME)).rejects.toThrow("didn't copy the photo");

  vi.spyOn(cloudinary.uploader, "upload").mockResolvedValueOnce({ public_id: NAME } as never);
  await expect(copyPhoto(SOURCE, NAME)).rejects.toThrow("didn't copy the photo");
});
