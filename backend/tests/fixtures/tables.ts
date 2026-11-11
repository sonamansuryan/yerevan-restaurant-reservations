// Tables as the database hands them over (src/modules/tables/tables.service.ts).
import type { TableZone } from "../../src/generated/prisma/enums.ts";

/** A Table row with what the service selects. */
export interface TableRow {
  id: string;
  label: string;
  capacity: number;
  minCapacity: number;
  zone: TableZone;
  isActive: boolean;
}

/** Lori Smokehouse's T1: four seats, for two to four guests, indoors. */
export function tableRow(extra: Partial<TableRow> = {}): TableRow {
  return {
    id: "4f3e2d1c-0b9a-4876-9543-210fedcba987",
    label: "T1",
    capacity: 4,
    minCapacity: 2,
    zone: "INDOOR",
    isActive: true,
    ...extra,
  };
}

/** What locking a table reads: its seats and state, and its restaurant's time zone. */
export interface LockedTableRow {
  capacity: number;
  minCapacity: number;
  isActive: boolean;
  timezone: string;
}

export function lockedTableRow(extra: Partial<LockedTableRow> = {}): LockedTableRow {
  return { capacity: 4, minCapacity: 2, isActive: true, timezone: "Asia/Yerevan", ...extra };
}

/** Lori Smokehouse's tables, as seeded: T1 is tableRow()'s. */
export function loriTables(): TableRow[] {
  return [
    tableRow(),
    tableRow({ id: "5e4d3c2b-1a09-4f87-8654-3210fedcba98", label: "T2" }),
    tableRow({ id: "6d5c4b3a-2918-4e76-9765-43210fedcba9", label: "T3" }),
    tableRow({
      id: "7c6b5a49-3827-4d65-8876-543210fedcba",
      label: "T4",
      capacity: 6,
      minCapacity: 3,
    }),
    tableRow({
      id: "8b7a6958-4736-4c54-9987-6543210fedcb",
      label: "T5",
      capacity: 8,
      minCapacity: 4,
    }),
    tableRow({ id: "9a897867-5645-4b43-8a98-76543210fedc", label: "P1", zone: "TERRACE" }),
  ];
}

/** Tsiran Wine Room's tables, as seeded: two seats at the bar, and three tables. */
export function tsiranTables(): TableRow[] {
  const small = { capacity: 2, minCapacity: 1 };
  return [
    tableRow({
      id: "a0b1c2d3-e4f5-4a6b-8c7d-9e0f1a2b3c4d",
      label: "B1",
      ...small,
      zone: "BAR_COUNTER",
    }),
    tableRow({
      id: "b1c2d3e4-f5a6-4b7c-9d8e-0f1a2b3c4d5e",
      label: "B2",
      ...small,
      zone: "BAR_COUNTER",
    }),
    tableRow({ id: "c2d3e4f5-a6b7-4c8d-8e9f-1a2b3c4d5e6f", label: "T1", ...small }),
    tableRow({ id: "d3e4f5a6-b7c8-4d9e-9f0a-2b3c4d5e6f70", label: "T2" }),
    tableRow({
      id: "e4f5a6b7-c8d9-4e0f-8a1b-3c4d5e6f7081",
      label: "T3",
      capacity: 6,
      minCapacity: 3,
    }),
  ];
}
