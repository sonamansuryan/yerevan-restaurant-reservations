import { Router } from "express";

import { validate } from "../../middleware/validate.ts";
import { cover, list, remove, save, uploadPermission } from "./photos.controller.ts";
import { coverSchema, photoIdSchema, savePhotoSchema } from "./photos.schemas.ts";

// One restaurant's photos, at /api/owner/restaurants/:restaurantId/photos. owner.routes.ts mounts
// this after the ownership check, so the restaurant is the owner's own. Its id is read from
// res.locals.restaurantId, so this router needs no restaurant parameter.
export const photosRouter = Router();

// The photos as saved, in the same shape every change answers with.
photosRouter.get("/", list);

// An upload has two steps: permission first, then the photo goes straight from the browser to
// Cloudinary, and Cloudinary's answer is saved here.
photosRouter.post("/signature", uploadPermission);
photosRouter.post("/", validate(savePhotoSchema), save);

photosRouter.patch("/:photoId", validate(photoIdSchema, "params"), validate(coverSchema), cover);
photosRouter.delete("/:photoId", validate(photoIdSchema, "params"), remove);
