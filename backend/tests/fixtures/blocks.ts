// Blocks as the database hands them over (src/modules/blocks/blocks.service.ts).
import type { TableZone } from "../../src/generated/prisma/enums.ts";

/** A BlockedPeriod row with what the service selects. */
export interface BlockRow {
  id: string;
  startsAt: Date;
  endsAt: Date;
  reason: string | null;
  table: { id: string; label: string; zone: TableZone } | null;
  restaurant: { timezone: string };
}

/** Lori Smokehouse's T1, blocked on Saturday 14 November 2026 from 12:00 to 15:00 in Yerevan. */
export function blockRow(extra: Partial<BlockRow> = {}): BlockRow {
  return {
    id: "6b5a4c3d-2e1f-4a0b-9c8d-7e6f5a4b3c2d",
    startsAt: new Date("2026-11-14T08:00:00.000Z"),
    endsAt: new Date("2026-11-14T11:00:00.000Z"),
    reason: "A wobbly leg",
    table: { id: "4f3e2d1c-0b9a-4876-9543-210fedcba987", label: "T1", zone: "INDOOR" },
    restaurant: { timezone: "Asia/Yerevan" },
    ...extra,
  };
}
