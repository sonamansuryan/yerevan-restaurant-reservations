import { z } from "zod";

import { ZONE_LABELS, guestsWords } from "@/features/dashboard/labels";
import type { OwnerBlock, OwnerReservation, OwnerTable, TableZone } from "@/types/api";

/** The most guests one table can seat: the server's limit (tables.schemas.ts). */
export const MAX_SEATS = 50;
/** 1 to 50, for the seat selects. */
export const SEAT_COUNTS = Array.from({ length: MAX_SEATS }, (_, index) => index + 1);
/** The areas, in the order the Tables page shows them. */
export const ZONES = Object.keys(ZONE_LABELS) as [TableZone, ...TableZone[]];

// The server's rules and words (backend/src/modules/tables/tables.schemas.ts), so a problem shows
// under its field at once. The server still checks everything again.
const LABEL = "Enter the table's name, such as T4.";
const MIN_ABOVE_SEATS = "Use no more than the table's seats.";

// A select holds text, such as "4". This turns it into the number the server expects.
const seatCount = (message: string) =>
  z
    .string()
    .min(1, message)
    .transform(Number)
    .pipe(z.number().int(message).min(1, message).max(MAX_SEATS, message));

export const tableFormSchema = z
  .object({
    label: z.string().trim().min(1, LABEL).max(20, "Use 20 characters or fewer."),
    capacity: seatCount(`Choose how many guests it seats, from 1 to ${MAX_SEATS}.`),
    minCapacity: seatCount(`Choose the fewest guests it's for, from 1 to ${MAX_SEATS}.`),
    zone: z.enum(ZONES, { error: "Choose a zone from the list." }),
  })
  .refine(({ capacity, minCapacity }) => minCapacity <= capacity, {
    path: ["minCapacity"],
    message: MIN_ABOVE_SEATS,
  });

/** What the table form's fields hold. Seats are text, as a select holds them. */
export type TableFields = z.input<typeof tableFormSchema>;
/** What's sent, for a new table or a change: seats as numbers, the name trimmed. */
export type TableRequest = z.output<typeof tableFormSchema>;

export const TABLE_FIELDS = [
  "label",
  "capacity",
  "minCapacity",
  "zone",
] as const satisfies readonly (keyof TableFields)[];

/** A new table: four seats, for any party, indoors. */
export const NEW_TABLE: TableFields = {
  label: "",
  capacity: "4",
  minCapacity: "1",
  zone: "INDOOR",
};

/** A saved table, as its form shows it. */
export function tableFields(table: OwnerTable): TableFields {
  return {
    label: table.label,
    capacity: String(table.capacity),
    minCapacity: String(table.minCapacity),
    zone: table.zone,
  };
}

/** "Table T4". A name that already says so, such as "Table 1", is left as it is. */
export function tableName(label: string): string {
  return /^table\b/i.test(label.trim()) ? label : `Table ${label}`;
}

/** "2–4 guests", or "4 guests" for a table that takes exactly four. */
export function guestRange({
  minCapacity,
  capacity,
}: Pick<OwnerTable, "minCapacity" | "capacity">): string {
  return minCapacity === capacity ? guestsWords(capacity) : `${minCapacity}–${capacity} guests`;
}

/** "6 tables, 28 seats": what can be booked. Then how many are inactive, if any. */
export function tablesSummary(tables: OwnerTable[]): string {
  const active = tables.filter((table) => table.isActive);
  const seats = active.reduce((sum, table) => sum + table.capacity, 0);
  const counted = `${active.length === 1 ? "1 table" : `${active.length} tables`}, ${seats === 1 ? "1 seat" : `${seats} seats`}`;
  const inactive = tables.length - active.length;
  return inactive > 0 ? `${counted} · ${inactive} inactive` : counted;
}

/** The tables by area, in ZONES' order, each in the order it was added. Empty areas are left out. */
export function tablesByZone<Table extends { zone: TableZone }>(
  tables: readonly Table[],
): { zone: TableZone; tables: Table[] }[] {
  return ZONES.map((zone) => ({
    zone,
    tables: tables.filter((table) => table.zone === zone),
  })).filter((area) => area.tables.length > 0);
}

/** How a table stands at a moment, for the floor plan. */
export type TableNow =
  | { kind: "off" }
  | { kind: "blocked"; until: string }
  | { kind: "seated"; until: string }
  | { kind: "reserved"; at: string }
  | { kind: "free" };

/**
 * How a table stands at `now`, for the floor plan, from the day's bookings and the blocked times:
 * switched off, blocked by a block that covers now, seated by a guest marked arrived whose booking
 * covers now, reserved by the next booking still to come or under way, or free. Only arrived
 * guests count as seated: a confirmed booking whose time has come is still reserved until the
 * guest is marked arrived.
 */
export function tableNow(
  table: OwnerTable,
  bookings: OwnerReservation[],
  blocks: OwnerBlock[],
  now: number,
): TableNow {
  if (!table.isActive) return { kind: "off" };
  const covers = (startsAt: string, endsAt: string): boolean =>
    Date.parse(startsAt) <= now && now < Date.parse(endsAt);
  const block = blocks.find(
    (one) => (one.table === null || one.table.id === table.id) && covers(one.startsAt, one.endsAt),
  );
  if (block) return { kind: "blocked", until: block.ends.time };
  const mine = bookings.filter((booking) => booking.table.id === table.id);
  const seated = mine.find(
    (booking) => booking.status === "ARRIVED" && covers(booking.startsAt, booking.endsAt),
  );
  if (seated) return { kind: "seated", until: seated.ends };
  const [next] = mine
    .filter(
      (booking) =>
        (booking.status === "PENDING" || booking.status === "CONFIRMED") &&
        Date.parse(booking.endsAt) > now,
    )
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  return next ? { kind: "reserved", at: next.starts } : { kind: "free" };
}

/** A table's name in a few letters for its square, such as "T4": the name itself when it's short. */
export function tableCode(label: string): string {
  const name = label.trim();
  if (name.length <= 4) return name;
  const number = /(\d+)\s*$/.exec(name)?.[1] ?? "";
  const code = `${name.charAt(0).toUpperCase()}${number}`;
  // A number too long to fit isn't cut, which could name another table: the letter stands alone.
  return code.length <= 4 ? code : name.charAt(0).toUpperCase();
}
