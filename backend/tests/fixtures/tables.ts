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
