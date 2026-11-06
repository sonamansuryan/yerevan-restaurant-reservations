import { Prisma } from "../generated/prisma/client.ts";

const PG_EXCLUSION_VIOLATION = "23P01"; // PostgreSQL SQLSTATE
const PRISMA_UNIQUE_VIOLATION = "P2002";

/** True when Postgres rejected a write because a unique index already holds that value. */
export function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === PRISMA_UNIQUE_VIOLATION
  );
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
