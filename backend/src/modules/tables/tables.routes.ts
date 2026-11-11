import { Router } from "express";

import { validate } from "../../middleware/validate.ts";
import { add, list, update } from "./tables.controller.ts";
import {
  createTableSchema,
  tableIdSchema,
  tableListSchema,
  updateTableSchema,
} from "./tables.schemas.ts";

// One restaurant's tables, at /api/owner/restaurants/:restaurantId/tables. owner.routes.ts mounts
// this after the ownership check, so the restaurant is the owner's own. Its id is read from
// res.locals.restaurantId, so this router needs no restaurant parameter.
export const tablesRouter = Router();

tablesRouter.get("/", validate(tableListSchema, "query"), list);
tablesRouter.post("/", validate(createTableSchema), add);
// Edits, deactivating ({ isActive: false }) and activating again. Tables are never deleted.
tablesRouter.patch(
  "/:tableId",
  validate(tableIdSchema, "params"),
  validate(updateTableSchema),
  update,
);
