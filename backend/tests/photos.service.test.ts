// A restaurant's photos (src/modules/photos/photos.service.ts), with Prisma replaced and Cloudinary's
// network calls replaced. Folders and addresses stay real; whether a reply is genuine is set here.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { Prisma } from "../src/generated/prisma/client.ts";
import {
  deleteUpload,
  isGenuineUpload,
  signUpload,
} from "../src/integrations/cloudinary/photos.ts";
import { ConflictError, NotFoundError, ValidationError } from "../src/lib/errors.ts";
import { logger } from "../src/lib/logger.ts";
import { prisma } from "../src/lib/prisma.ts";
import {
  deletePhoto,
  getPhotos,
  makeCover,
  permitUpload,
  savePhoto,
} from "../src/modules/photos/photos.service.ts";
import { ownedRow } from "./fixtures/restaurants.ts";
import { ani } from "./fixtures/users.ts";

vi.mock("../src/lib/prisma.ts", () => ({
  prisma: { $transaction: vi.fn(), restaurantPhoto: { count: vi.fn(), findMany: vi.fn() } },
  isDatabaseReachable: vi.fn(),
}));
vi.mock("../src/integrations/cloudinary/photos.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/integrations/cloudinary/photos.ts")>()),
  signUpload: vi.fn(),
  isGenuineUpload: vi.fn(),
  deleteUpload: vi.fn(),
}));

// What the transaction hands the service: the calls it makes, each recorded.
const tx = {
  $queryRaw: vi.fn(),
  restaurantPhoto: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
};

const RESTAURANT = ownedRow().id;
const PHOTO = "0f9c1d2e-3b4a-4c5d-8e6f-7a8b9c0d1e2f";
const upload = {
  publicId: `seghan/restaurants/${RESTAURANT}/1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d`,
  version: 1731240000,
  signature: "a".repeat(40),
};

beforeEach(() => {
  vi.mocked(prisma.$transaction).mockImplementation(((work: (client: typeof tx) => unknown) =>
    work(tx)) as never);
  // The lock finds the restaurant, Cloudinary's replies are genuine, and the list reads back.
  tx.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
  vi.mocked(isGenuineUpload).mockReturnValue(true);
  vi.mocked(deleteUpload).mockResolvedValue();
});

afterEach(() => {
  vi.resetAllMocks();
});

/** The order the given calls were first made in. */
const firstCalls = (...steps: { mock: { invocationCallOrder: number[] } }[]): number[] =>
  steps.map((step) => step.mock.invocationCallOrder[0] ?? Number.NaN);

function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Database error", {
    code,
    clientVersion: "test",
  });
}

describe("permitUpload", () => {
  test("signs a permission while the restaurant has room for another photo", async () => {
    const permission = {
      url: "https://api.cloudinary.com/v1_1/test-cloud/image/upload",
      fields: {},
    };
    vi.mocked(prisma.restaurantPhoto.count).mockResolvedValue(9);
    vi.mocked(signUpload).mockReturnValue(permission);

    await expect(permitUpload(RESTAURANT)).resolves.toBe(permission);
    expect(signUpload).toHaveBeenCalledWith(RESTAURANT);
  });

  test("with ten photos already, no upload is allowed (409)", async () => {
    vi.mocked(prisma.restaurantPhoto.count).mockResolvedValue(10);

    await expect(permitUpload(RESTAURANT)).rejects.toMatchObject({
      statusCode: 409,
      code: "TOO_MANY_PHOTOS",
      message: "A restaurant can have up to 10 photos. Delete one to add another.",
    });
    expect(signUpload).not.toHaveBeenCalled();
  });
});

describe("savePhoto", () => {
  test("the first photo becomes the cover, at the address built here", async () => {
    tx.restaurantPhoto.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await savePhoto(ani.id, RESTAURANT, upload);

    expect(tx.restaurantPhoto.create).toHaveBeenCalledWith({
      data: {
        restaurantId: RESTAURANT,
        publicId: upload.publicId,
        url: `https://res.cloudinary.com/test-cloud/image/upload/v1731240000/${upload.publicId}`,
        isCover: true,
        sortOrder: 0,
      },
    });
    // The restaurant is locked before anything is read or written.
    const [lock, read, create] = firstCalls(
      tx.$queryRaw,
      tx.restaurantPhoto.findMany,
      tx.restaurantPhoto.create,
    );
    expect(lock).toBeLessThan(read ?? 0);
    expect(read).toBeLessThan(create ?? 0);
  });

  test("later photos go after the last one, and aren't the cover", async () => {
    tx.restaurantPhoto.findMany.mockResolvedValueOnce([{ sortOrder: 0 }, { sortOrder: 3 }]);
    tx.restaurantPhoto.findMany.mockResolvedValueOnce([]);

    await savePhoto(ani.id, RESTAURANT, upload);

    expect(tx.restaurantPhoto.create.mock.calls[0]?.[0].data).toMatchObject({
      isCover: false,
      sortOrder: 4,
    });
  });

  test("replies with the restaurant's photos, the cover first", async () => {
    const photos = [
      { id: PHOTO, url: "https://res.cloudinary.com/x", isCover: true, sortOrder: 0 },
    ];
    tx.restaurantPhoto.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(photos);

    await expect(savePhoto(ani.id, RESTAURANT, upload)).resolves.toEqual(photos);
    expect(tx.restaurantPhoto.findMany).toHaveBeenLastCalledWith({
      where: { restaurantId: RESTAURANT },
      orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
      select: { id: true, url: true, isCover: true, sortOrder: true },
    });
  });

  test("a photo from another restaurant's folder is refused before the database is asked", async () => {
    const elsewhere = {
      ...upload,
      publicId:
        "seghan/restaurants/e5b8a7c6-9f0d-4e1b-8c23-4d5e6f708192/1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
    };

    const saving = savePhoto(ani.id, RESTAURANT, elsewhere);

    await expect(saving).rejects.toThrow(ValidationError);
    await expect(saving).rejects.toMatchObject({ statusCode: 400, code: "UPLOAD_NOT_VERIFIED" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("a reply Cloudinary didn't sign is refused, and nothing is saved", async () => {
    vi.mocked(isGenuineUpload).mockReturnValue(false);

    await expect(savePhoto(ani.id, RESTAURANT, upload)).rejects.toMatchObject({
      code: "UPLOAD_NOT_VERIFIED",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("an eleventh photo is refused (409), and nothing is saved", async () => {
    tx.restaurantPhoto.findMany.mockResolvedValueOnce(
      Array.from({ length: 10 }, (_, sortOrder) => ({ sortOrder })),
    );

    await expect(savePhoto(ani.id, RESTAURANT, upload)).rejects.toMatchObject({
      code: "TOO_MANY_PHOTOS",
    });
    expect(tx.restaurantPhoto.create).not.toHaveBeenCalled();
  });

  test("the same upload saved twice is a 409, not a 500", async () => {
    tx.restaurantPhoto.findMany.mockResolvedValueOnce([]);
    tx.restaurantPhoto.create.mockRejectedValue(prismaError("P2002"));

    const saving = savePhoto(ani.id, RESTAURANT, upload);

    await expect(saving).rejects.toThrow(ConflictError);
    await expect(saving).rejects.toMatchObject({ code: "PHOTO_ALREADY_SAVED" });
  });

  test("someone else's restaurant locks nothing: 404, and nothing is saved", async () => {
    tx.$queryRaw.mockResolvedValue([]);

    await expect(savePhoto(ani.id, RESTAURANT, upload)).rejects.toMatchObject({
      code: "RESTAURANT_NOT_FOUND",
    });
    expect(tx.restaurantPhoto.create).not.toHaveBeenCalled();
  });
});

describe("makeCover", () => {
  test("the old cover becomes an ordinary photo, then this one becomes the cover", async () => {
    tx.restaurantPhoto.findFirst.mockResolvedValue({ id: PHOTO, publicId: "p", isCover: false });
    tx.restaurantPhoto.findMany.mockResolvedValue([]);

    await makeCover(ani.id, RESTAURANT, PHOTO);

    expect(tx.restaurantPhoto.findFirst).toHaveBeenCalledWith({
      where: { id: PHOTO, restaurantId: RESTAURANT },
      select: { id: true, publicId: true, isCover: true },
    });
    expect(tx.restaurantPhoto.updateMany).toHaveBeenCalledWith({
      where: { restaurantId: RESTAURANT, isCover: true },
      data: { isCover: false },
    });
    expect(tx.restaurantPhoto.update).toHaveBeenCalledWith({
      where: { id: PHOTO },
      data: { isCover: true },
    });
    const [lock, unset, set] = firstCalls(
      tx.$queryRaw,
      tx.restaurantPhoto.updateMany,
      tx.restaurantPhoto.update,
    );
    expect(lock).toBeLessThan(unset ?? 0);
    expect(unset).toBeLessThan(set ?? 0);
  });

  test("a photo that isn't this restaurant's is a 404, and no cover changes", async () => {
    tx.restaurantPhoto.findFirst.mockResolvedValue(null);

    const choosing = makeCover(ani.id, RESTAURANT, PHOTO);

    await expect(choosing).rejects.toThrow(NotFoundError);
    await expect(choosing).rejects.toMatchObject({ code: "PHOTO_NOT_FOUND" });
    expect(tx.restaurantPhoto.updateMany).not.toHaveBeenCalled();
  });
});

describe("deletePhoto", () => {
  test("deletes it here, then at Cloudinary, after the database is done", async () => {
    tx.restaurantPhoto.findFirst.mockResolvedValueOnce({
      id: PHOTO,
      publicId: upload.publicId,
      isCover: false,
    });
    tx.restaurantPhoto.findMany.mockResolvedValue([]);

    await expect(deletePhoto(ani.id, RESTAURANT, PHOTO)).resolves.toEqual([]);

    expect(tx.restaurantPhoto.delete).toHaveBeenCalledWith({ where: { id: PHOTO } });
    expect(deleteUpload).toHaveBeenCalledWith(upload.publicId);
    const [deleted, atCloudinary] = firstCalls(tx.restaurantPhoto.delete, vi.mocked(deleteUpload));
    expect(deleted).toBeLessThan(atCloudinary ?? 0);
    // Not the cover, so no other photo changes.
    expect(tx.restaurantPhoto.update).not.toHaveBeenCalled();
  });

  test("deleting the cover hands it to the next photo", async () => {
    tx.restaurantPhoto.findFirst
      .mockResolvedValueOnce({ id: PHOTO, publicId: upload.publicId, isCover: true })
      .mockResolvedValueOnce({ id: "next-photo" });
    tx.restaurantPhoto.findMany.mockResolvedValue([]);

    await deletePhoto(ani.id, RESTAURANT, PHOTO);

    expect(tx.restaurantPhoto.findFirst).toHaveBeenLastCalledWith({
      where: { restaurantId: RESTAURANT },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });
    expect(tx.restaurantPhoto.update).toHaveBeenCalledWith({
      where: { id: "next-photo" },
      data: { isCover: true },
    });
  });

  test("if Cloudinary fails, the photo is still gone from Seghan, and the failure is logged", async () => {
    tx.restaurantPhoto.findFirst.mockResolvedValueOnce({
      id: PHOTO,
      publicId: upload.publicId,
      isCover: false,
    });
    tx.restaurantPhoto.findMany.mockResolvedValue([]);
    vi.mocked(deleteUpload).mockRejectedValue(new Error("Cloudinary is down"));
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});

    await expect(deletePhoto(ani.id, RESTAURANT, PHOTO)).resolves.toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ publicId: upload.publicId }),
      "Cloudinary didn't delete a photo",
    );
  });

  test("a photo that isn't this restaurant's is a 404, and Cloudinary isn't asked", async () => {
    tx.restaurantPhoto.findFirst.mockResolvedValue(null);

    await expect(deletePhoto(ani.id, RESTAURANT, PHOTO)).rejects.toMatchObject({
      code: "PHOTO_NOT_FOUND",
    });
    expect(tx.restaurantPhoto.delete).not.toHaveBeenCalled();
    expect(deleteUpload).not.toHaveBeenCalled();
  });
});

describe("getPhotos", () => {
  test("reads the photos as saved, the cover first, in the shape every change answers with", async () => {
    const photos = [
      { id: PHOTO, url: "https://res.cloudinary.com/x", isCover: true, sortOrder: 0 },
    ];
    vi.mocked(prisma.restaurantPhoto.findMany).mockResolvedValue(photos as never);

    await expect(getPhotos(RESTAURANT)).resolves.toEqual(photos);
    expect(prisma.restaurantPhoto.findMany).toHaveBeenCalledWith({
      where: { restaurantId: RESTAURANT },
      orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
      select: { id: true, url: true, isCover: true, sortOrder: true },
    });
  });
});
