import { Router } from "express";

import { validate } from "../../middleware/validate.ts";
import { add, list, remove } from "./blocks.controller.ts";
import { blockIdSchema, blockListSchema, createBlockSchema } from "./blocks.schemas.ts";

// One restaurant's blocks, at /api/owner/restaurants/:restaurantId/blocks. owner.routes.ts mounts
// this after the ownership check, so the restaurant is the owner's own. Its id is read from
// res.locals.restaurantId, so this router needs no restaurant parameter.
export const blocksRouter = Router();

blocksRouter.get("/", validate(blockListSchema, "query"), list);
blocksRouter.post("/", validate(createBlockSchema), add);
blocksRouter.delete("/:blockId", validate(blockIdSchema, "params"), remove);
