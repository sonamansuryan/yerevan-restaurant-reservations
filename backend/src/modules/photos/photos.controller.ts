import type { RequestHandler } from "express";

import type { SessionUser } from "../auth/token.service.ts";
import type { PhotoIdParams, SavePhotoInput } from "./photos.schemas.ts";
import { deletePhoto, makeCover, permitUpload, savePhoto } from "./photos.service.ts";

// The router runs requireAuth and requireRestaurantOwner first, and `validate` has checked the
// rest. So req.user is set, and res.locals.restaurantId is a restaurant this owner owns.

export const uploadPermission: RequestHandler = async (_req, res) => {
  const restaurantId = res.locals["restaurantId"] as string;
  res.json({ upload: await permitUpload(restaurantId) });
};

export const save: RequestHandler = async (req, res) => {
  const { id: ownerId } = req.user as SessionUser;
  const restaurantId = res.locals["restaurantId"] as string;
  const photos = await savePhoto(ownerId, restaurantId, req.body as SavePhotoInput);
  res.status(201).json({ photos });
};

export const cover: RequestHandler = async (req, res) => {
  const { id: ownerId } = req.user as SessionUser;
  const restaurantId = res.locals["restaurantId"] as string;
  const { photoId } = res.locals["params"] as PhotoIdParams;
  res.json({ photos: await makeCover(ownerId, restaurantId, photoId) });
};

export const remove: RequestHandler = async (req, res) => {
  const { id: ownerId } = req.user as SessionUser;
  const restaurantId = res.locals["restaurantId"] as string;
  const { photoId } = res.locals["params"] as PhotoIdParams;
  res.json({ photos: await deletePhoto(ownerId, restaurantId, photoId) });
};
