import type { RequestHandler } from "express";

import type { SessionUser } from "../auth/token.service.ts";
import type {
  CreateTableInput,
  TableIdParams,
  TableListQuery,
  UpdateTableInput,
} from "./tables.schemas.ts";
import { addTable, listTables, updateTable } from "./tables.service.ts";

// The router runs requireAuth and requireRestaurantOwner first, and `validate` has checked the
// rest. So req.user is set, and res.locals.restaurantId is a restaurant this owner owns.

export const list: RequestHandler = async (_req, res) => {
  const restaurantId = res.locals["restaurantId"] as string;
  const query = res.locals["query"] as TableListQuery;
  res.json(await listTables(restaurantId, query));
};

export const add: RequestHandler = async (req, res) => {
  const { id: ownerId } = req.user as SessionUser;
  const restaurantId = res.locals["restaurantId"] as string;
  const table = await addTable(ownerId, restaurantId, req.body as CreateTableInput);
  res.status(201).json({ table });
};

export const update: RequestHandler = async (req, res) => {
  const { id: ownerId } = req.user as SessionUser;
  const restaurantId = res.locals["restaurantId"] as string;
  const { tableId } = res.locals["params"] as TableIdParams;
  const table = await updateTable(ownerId, restaurantId, tableId, req.body as UpdateTableInput);
  res.json({ table });
};
