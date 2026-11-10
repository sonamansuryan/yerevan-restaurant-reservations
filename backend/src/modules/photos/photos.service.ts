// A restaurant's photos. The images themselves live at Cloudinary; the database keeps each one's
// name there, its address, which one is the cover, and their order.
import type { Prisma } from "../../generated/prisma/client.ts";
import {
  deleteUpload,
  isGenuineUpload,
  photoAddress,
  photoFolder,
  signUpload,
} from "../../integrations/cloudinary/photos.ts";
import type { UploadPermission, UploadReply } from "../../integrations/cloudinary/photos.ts";
import { isUniqueViolation } from "../../lib/db-errors.ts";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors.ts";
import { logger } from "../../lib/logger.ts";
import { prisma } from "../../lib/prisma.ts";
import { lockOwnedRestaurant } from "../restaurants/owner.service.ts";

/** A cover and the six more the restaurant page shows, with a few to spare. */
export const MAX_PHOTOS = 10;
const TOO_MANY = `A restaurant can have up to ${MAX_PHOTOS} photos. Delete one to add another.`;

/** A photo as its owner sees it in the dashboard. */
export interface OwnerPhoto {
  id: string;
  url: string;
  isCover: boolean;
  sortOrder: number;
}

/** The restaurant's photos, the cover first, then in the order they were added. */
async function listPhotos(
  tx: Prisma.TransactionClient,
  restaurantId: string,
): Promise<OwnerPhoto[]> {
  const rows = await tx.restaurantPhoto.findMany({
    where: { restaurantId },
    orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
    select: { id: true, url: true, isCover: true, sortOrder: true },
  });
  return rows.map(({ id, url, isCover, sortOrder }) => ({ id, url, isCover, sortOrder }));
}

/**
 * Every change to the photos locks the restaurant first, so changes take turns: two quick clicks
 * on "make cover" can never leave two covers. Someone else's restaurant is a 404.
 */
async function lockRestaurant(
  tx: Prisma.TransactionClient,
  ownerId: string,
  restaurantId: string,
): Promise<void> {
  if (!(await lockOwnedRestaurant(tx, ownerId, restaurantId))) {
    throw new NotFoundError("RESTAURANT_NOT_FOUND");
  }
}

/** One of this restaurant's photos. The restaurant is part of the query: another's is a 404. */
async function findPhoto(
  tx: Prisma.TransactionClient,
  restaurantId: string,
  photoId: string,
): Promise<{ id: string; publicId: string; isCover: boolean }> {
  const photo = await tx.restaurantPhoto.findFirst({
    where: { id: photoId, restaurantId },
    select: { id: true, publicId: true, isCover: true },
  });
  if (!photo) throw new NotFoundError("PHOTO_NOT_FOUND");
  return photo;
}

/** Permission for the browser to upload one photo of this restaurant straight to Cloudinary. */
export async function permitUpload(restaurantId: string): Promise<UploadPermission> {
  // Checked here as well as when saving, so nobody uploads a photo that can't be saved.
  const photos = await prisma.restaurantPhoto.count({ where: { restaurantId } });
  if (photos >= MAX_PHOTOS) throw new ConflictError("TOO_MANY_PHOTOS", TOO_MANY);
  return signUpload(restaurantId);
}

/**
 * Saves an uploaded photo, once it's proven: Cloudinary signed the reply, and the photo is in this
 * restaurant's folder. Its address is built here. The first photo becomes the cover.
 */
export async function savePhoto(
  ownerId: string,
  restaurantId: string,
  upload: UploadReply,
): Promise<OwnerPhoto[]> {
  if (!upload.publicId.startsWith(`${photoFolder(restaurantId)}/`) || !isGenuineUpload(upload)) {
    throw new ValidationError("UPLOAD_NOT_VERIFIED");
  }
  const url = photoAddress(upload.publicId, upload.version);

  try {
    return await prisma.$transaction(async (tx) => {
      await lockRestaurant(tx, ownerId, restaurantId);
      const photos = await tx.restaurantPhoto.findMany({
        where: { restaurantId },
        select: { sortOrder: true },
      });
      if (photos.length >= MAX_PHOTOS) throw new ConflictError("TOO_MANY_PHOTOS", TOO_MANY);
      await tx.restaurantPhoto.create({
        data: {
          restaurantId,
          publicId: upload.publicId,
          url,
          isCover: photos.length === 0,
          sortOrder: Math.max(-1, ...photos.map(({ sortOrder }) => sortOrder)) + 1,
        },
      });
      return listPhotos(tx, restaurantId);
    });
  } catch (error) {
    // Each upload has its own name, so the same one saved twice breaks the unique publicId.
    if (isUniqueViolation(error)) throw new ConflictError("PHOTO_ALREADY_SAVED");
    throw error;
  }
}

/** Makes one of the restaurant's photos its cover. The old cover becomes an ordinary photo. */
export async function makeCover(
  ownerId: string,
  restaurantId: string,
  photoId: string,
): Promise<OwnerPhoto[]> {
  return prisma.$transaction(async (tx) => {
    await lockRestaurant(tx, ownerId, restaurantId);
    await findPhoto(tx, restaurantId, photoId);
    await tx.restaurantPhoto.updateMany({
      where: { restaurantId, isCover: true },
      data: { isCover: false },
    });
    await tx.restaurantPhoto.update({ where: { id: photoId }, data: { isCover: true } });
    return listPhotos(tx, restaurantId);
  });
}

/**
 * Deletes one of the restaurant's photos. If it was the cover, the next photo takes over. Then the
 * image is deleted at Cloudinary too.
 */
export async function deletePhoto(
  ownerId: string,
  restaurantId: string,
  photoId: string,
): Promise<OwnerPhoto[]> {
  const { publicId, photos } = await prisma.$transaction(async (tx) => {
    await lockRestaurant(tx, ownerId, restaurantId);
    const photo = await findPhoto(tx, restaurantId, photoId);
    await tx.restaurantPhoto.delete({ where: { id: photo.id } });
    if (photo.isCover) {
      const next = await tx.restaurantPhoto.findFirst({
        where: { restaurantId },
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      });
      if (next) {
        await tx.restaurantPhoto.update({ where: { id: next.id }, data: { isCover: true } });
      }
    }
    return { publicId: photo.publicId, photos: await listPhotos(tx, restaurantId) };
  });

  // After the database is done, never inside its transaction: Cloudinary is another service, over
  // the network. If it fails, the photo is still gone from Seghan, and all that's left is an unused
  // image at Cloudinary. Its name is logged so it can be found.
  try {
    await deleteUpload(publicId);
  } catch (err) {
    logger.warn({ err, publicId }, "Cloudinary didn't delete a photo");
  }
  return photos;
}
