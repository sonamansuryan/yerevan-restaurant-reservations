import { Prisma } from "../generated/prisma/client.ts";

const PG_EXCLUSION_VIOLATION = "23P01"; // PostgreSQL SQLSTATE
const PRISMA_UNIQUE_VIOLATION = "P2002";
const PRISMA_RECORD_MISSING = "P2025";

/** True when Postgres rejected a write because a unique index already holds that value. */
export function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === PRISMA_UNIQUE_VIOLATION
  );
}

/**
 * True when an update found no row to change, such as when its `where` names an owner who doesn't
 * own that row. That's a missing thing (404), not a database failure.
 */
export function isRecordMissing(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === PRISMA_RECORD_MISSING;
}

/**
 * True when Postgres rejected a write because of an EXCLUDE constraint, such as
 * "Reservation_no_overlap".
 */
export function isExclusionViolation(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
  // The Prisma code P2039 isn't enough, because CHECK violations use it too. Only the SQLSTATE
  // tells them apart.
  const adapterError = err.meta?.driverAdapterError as
    { cause?: { originalCode?: string } } | undefined;
  return adapterError?.cause?.originalCode === PG_EXCLUSION_VIOLATION;
}
