import type { RequestHandler } from "express";

import type { SessionUser } from "../auth/token.service.ts";
import type { RestaurantSlugParams } from "../restaurants/restaurants.schemas.ts";
import type { FavoriteListQuery } from "./favorites.schemas.ts";
import { getFavorite, listFavorites, removeFavorite, saveFavorite } from "./favorites.service.ts";

// The routes have checked the input with `validate`. Favorites are for signed-in guests only, and
// they're always the favorites of whoever is signed in, never someone the request names.

const guest = (req: Parameters<RequestHandler>[0]): string => (req.user as SessionUser).id;
const slugOf = (res: Parameters<RequestHandler>[1]): string =>
  (res.locals["params"] as RestaurantSlugParams).slug;

export const list: RequestHandler = async (req, res) => {
  res.json(await listFavorites(guest(req), res.locals["query"] as FavoriteListQuery));
};

export const show: RequestHandler = async (req, res) => {
  res.json(await getFavorite(guest(req), slugOf(res)));
};

export const save: RequestHandler = async (req, res) => {
  res.json(await saveFavorite(guest(req), slugOf(res)));
};

export const remove: RequestHandler = async (req, res) => {
  res.json(await removeFavorite(guest(req), slugOf(res)));
};
