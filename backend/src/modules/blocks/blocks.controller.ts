import type { RequestHandler } from "express";

import type { SessionUser } from "../auth/token.service.ts";
import type { BlockIdParams, BlockListQuery, CreateBlockInput } from "./blocks.schemas.ts";
import { addBlock, listBlocks, removeBlock } from "./blocks.service.ts";

// The router runs requireAuth and requireRestaurantOwner first, and `validate` has checked the
// rest. So req.user is set, and res.locals.restaurantId is a restaurant this owner owns.

export const list: RequestHandler = async (_req, res) => {
  const restaurantId = res.locals["restaurantId"] as string;
  const query = res.locals["query"] as BlockListQuery;
  res.json(await listBlocks(restaurantId, query));
};

export const add: RequestHandler = async (req, res) => {
  const { id: ownerId } = req.user as SessionUser;
  const restaurantId = res.locals["restaurantId"] as string;
  const block = await addBlock(ownerId, restaurantId, req.body as CreateBlockInput);
  res.status(201).json({ block });
};

export const remove: RequestHandler = async (req, res) => {
  const { id: ownerId } = req.user as SessionUser;
  const restaurantId = res.locals["restaurantId"] as string;
  const { blockId } = res.locals["params"] as BlockIdParams;
  await removeBlock(ownerId, restaurantId, blockId);
  res.status(204).end();
};
