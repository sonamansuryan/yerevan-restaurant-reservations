import type { RequestHandler } from "express";

import { env } from "../../config/env.ts";
import type { SessionUser } from "../auth/token.service.ts";
import type { PhotoIdParams, SavePhotoInput } from "./photos.schemas.ts";
import { deletePhoto, getPhotos, makeCover, permitUpload, savePhoto } from "./photos.service.ts";
import type { OwnerPhoto } from "./photos.service.ts";

// The router runs requireAuth and requireRestaurantOwner first, and `validate` has checked the
// rest. So req.user is set, and res.locals.restaurantId is a restaurant this owner owns.

/**
 * Every photo answer has this shape: the photos, cover first, and whether they can be changed. In
 * the public demo (PUBLIC_DEMO) they can't, so the photo manager offers no changes. It learns that
 * here, from the same switch that refuses each change with 403 DEMO_READ_ONLY (publicDemo.ts).
 */
function answer(photos: OwnerPhoto[]): { photos: OwnerPhoto[]; readOnly: boolean } {
  return { photos, readOnly: env.PUBLIC_DEMO };
}

export const list: RequestHandler = async (_req, res) => {
  const restaurantId = res.locals["restaurantId"] as string;
  res.json(answer(await getPhotos(restaurantId)));
};

export const uploadPermission: RequestHandler = async (_req, res) => {
  const restaurantId = res.locals["restaurantId"] as string;
  res.json({ upload: await permitUpload(restaurantId) });
};

export const save: RequestHandler = async (req, res) => {
  const { id: ownerId } = req.user as SessionUser;
  const restaurantId = res.locals["restaurantId"] as string;
  const photos = await savePhoto(ownerId, restaurantId, req.body as SavePhotoInput);
  res.status(201).json(answer(photos));
};

export const cover: RequestHandler = async (req, res) => {
  const { id: ownerId } = req.user as SessionUser;
  const restaurantId = res.locals["restaurantId"] as string;
  const { photoId } = res.locals["params"] as PhotoIdParams;
  res.json(answer(await makeCover(ownerId, restaurantId, photoId)));
};

export const remove: RequestHandler = async (req, res) => {
  const { id: ownerId } = req.user as SessionUser;
  const restaurantId = res.locals["restaurantId"] as string;
  const { photoId } = res.locals["params"] as PhotoIdParams;
  res.json(answer(await deletePhoto(ownerId, restaurantId, photoId)));
};
