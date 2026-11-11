import { z } from "zod";

import { TableZone } from "../../generated/prisma/enums.ts";
import { pagingFields } from "../../lib/paging.ts";

/** More tables than any restaurant has, so one page holds them all. */
export const TABLE_PAGE_SIZE = 100;

/** The most guests one table can seat: a long banquet table, with room to spare. */
export const MAX_SEATS = 50;

const LABEL = "Enter the table's name, such as T4.";
const SEATS = `Choose how many guests it seats, from 1 to ${MAX_SEATS}.`;
const MIN_SEATS = `Choose the fewest guests it's for, from 1 to ${MAX_SEATS}.`;
/** Minimum seats above the seats would offer the table to nobody. The database refuses it too. */
export const MIN_ABOVE_SEATS = "Use no more than the table's seats.";

/** GET /tables: the restaurant's tables, a page at a time like every list. */
export const tableListSchema = z.object(pagingFields(TABLE_PAGE_SIZE, TABLE_PAGE_SIZE));

/** /tables/:tableId. Table ids are UUIDs, so anything else is refused before the database is asked. */
export const tableIdSchema = z.object({
  tableId: z.uuid({ error: "Choose a table." }),
});

/**
 * A table's details. The database refuses a minimum below 1 or above the seats (Table_capacity),
 * so these rules match it, with messages people can act on. Which restaurant it belongs to comes
 * from the address, never from the body.
 */
const tableFields = {
  // "T4" or "Terrace 2". Unique within the restaurant, which the database checks.
  label: z.string({ error: LABEL }).trim().min(1, LABEL).max(20, "Use 20 characters or fewer."),
  capacity: z.number({ error: SEATS }).int(SEATS).min(1, SEATS).max(MAX_SEATS, SEATS),
  // So a couple isn't given the eight-seat table.
  minCapacity: z
    .number({ error: MIN_SEATS })
    .int(MIN_SEATS)
    .min(1, MIN_SEATS)
    .max(MAX_SEATS, MIN_SEATS),
  zone: z.enum(TableZone, { error: "Choose a zone from the list." }),
};

/** When both are sent, the minimum can't be above the seats. */
const seatsInOrder = ({ capacity, minCapacity }: { capacity?: number; minCapacity?: number }) =>
  capacity === undefined || minCapacity === undefined || minCapacity <= capacity;

/**
 * POST /tables. A new table is always active, so isActive isn't accepted here. Without a minimum
 * or a zone, the database's 1 and INDOOR apply.
 */
export const createTableSchema = z
  .object({
    ...tableFields,
    minCapacity: tableFields.minCapacity.optional(),
    zone: tableFields.zone.optional(),
  })
  .refine(seatsInOrder, { path: ["minCapacity"], message: MIN_ABOVE_SEATS });

/**
 * PATCH /tables/:tableId. Any of the details, and whether the table can be booked: isActive false
 * deactivates it, and true brings it back. A minimum sent without seats, or seats without a
 * minimum, is compared with the saved table by the service.
 */
export const updateTableSchema = z
  .object({
    ...tableFields,
    isActive: z.boolean({ error: "Choose whether the table can be booked." }),
  })
  .partial()
  .refine(
    (changes) => Object.values(changes).some((value) => value !== undefined),
    "Change at least one detail.",
  )
  .refine(seatsInOrder, { path: ["minCapacity"], message: MIN_ABOVE_SEATS });

export type TableListQuery = z.infer<typeof tableListSchema>;
export type TableIdParams = z.infer<typeof tableIdSchema>;
export type CreateTableInput = z.infer<typeof createTableSchema>;
export type UpdateTableInput = z.infer<typeof updateTableSchema>;
