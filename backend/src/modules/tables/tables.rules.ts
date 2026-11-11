// The rules for changing a table that need no database. They're plain functions, so they're
// tested on their own.

/** What a table is now, as far as these rules need. */
export interface SavedTable {
  capacity: number;
  minCapacity: number;
  isActive: boolean;
}

/** A change to a table, as far as these rules need. Anything not sent stays as it is. */
export interface TableChange {
  capacity?: number;
  minCapacity?: number;
  isActive?: boolean;
}

/** Why a change is refused: deactivating while booked, or too few seats for a booked party. */
export type Refusal = "TABLE_HAS_BOOKINGS" | "TABLE_TOO_SMALL";

/**
 * Guests can only book a published restaurant if it has an active table, so it must keep one.
 * Closing for a while is what unpublishing is for, as with an empty week of opening hours.
 */
export const LAST_ACTIVE_TABLE =
  "A published restaurant needs at least one active table. Activate or add another table first, or unpublish the restaurant.";

/** Whether the change switches an active table off. Switching off an inactive one changes nothing. */
export function isDeactivating(table: SavedTable, change: TableChange): boolean {
  return table.isActive && change.isActive === false;
}

/** The table's seats after the change: what's sent, and what's saved for the rest. */
export function seatsAfter(
  table: SavedTable,
  change: TableChange,
): { capacity: number; minCapacity: number } {
  return {
    capacity: change.capacity ?? table.capacity,
    minCapacity: change.minCapacity ?? table.minCapacity,
  };
}

/**
 * Whether the change could let an upcoming booking down, so the bookings must be read: switching
 * an active table off, or giving it fewer seats. Raising the minimum, a new name or zone, and
 * switching it back on never can, because the guests booked so far still fit.
 */
export function mayAffectBookings(table: SavedTable, change: TableChange): boolean {
  const shrinking = change.capacity !== undefined && change.capacity < table.capacity;
  return isDeactivating(table, change) || shrinking;
}

/**
 * The upcoming bookings a change would let down, and why, or null if it lets none down. All of
 * them stand in the way of deactivating. Fewer seats only fails the parties that wouldn't fit.
 */
export function bookingsInTheWay<Booking extends { partySize: number }>(
  table: SavedTable,
  change: TableChange,
  upcoming: readonly Booking[],
): { refusal: Refusal; bookings: Booking[] } | null {
  if (isDeactivating(table, change) && upcoming.length > 0) {
    return { refusal: "TABLE_HAS_BOOKINGS", bookings: [...upcoming] };
  }
  const capacity = change.capacity;
  if (capacity === undefined || capacity >= table.capacity) return null;
  const tooBig = upcoming.filter((booking) => booking.partySize > capacity);
  return tooBig.length > 0 ? { refusal: "TABLE_TOO_SMALL", bookings: tooBig } : null;
}

/** What the owner is told, with the number to keep: "Keep at least 4 seats …". */
export function refusalMessage(
  refusal: Refusal,
  bookings: readonly { partySize: number }[],
): string {
  const one = bookings.length === 1;
  if (refusal === "TABLE_HAS_BOOKINGS") {
    return one
      ? "An upcoming booking still needs this table. You can deactivate it once that booking is over or cancelled."
      : `${bookings.length} upcoming bookings still need this table. You can deactivate it once they're over or cancelled.`;
  }
  // A party that doesn't fit is bigger than the new seats, which are at least 1, so it's "guests".
  const biggest = Math.max(...bookings.map(({ partySize }) => partySize));
  return one
    ? `An upcoming booking for ${biggest} guests needs this table. Keep at least ${biggest} seats until it's over or cancelled.`
    : `${bookings.length} upcoming bookings need more seats than that, for up to ${biggest} guests. Keep at least ${biggest} seats until they're over or cancelled.`;
}
