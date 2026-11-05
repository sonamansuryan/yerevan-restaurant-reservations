import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "../config/env.ts";
import { PrismaClient } from "../generated/prisma/client.ts";
import { logger } from "./logger.ts";

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
  // pg waits forever by default, so a hung database would hang every request.
  connectionTimeoutMillis: 5_000,
  // The adapter sends times with no offset and discards the offset it reads back, so timestamptz
  // is only correct on a UTC session. Any other zone silently stores the wrong moment, and the
  // overlap constraint then compares the wrong times.
  options: "-c TimeZone=UTC",
});

// One client for the whole app, because each PrismaClient opens its own connection pool. A module
// runs once however many files import it, so everyone shares this instance. It connects on the
// first query, not here.
export const prisma = new PrismaClient({ adapter });

/** Runs the smallest possible query, to prove the database is reachable. */
export async function isDatabaseReachable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (err) {
    logger.error({ err }, "Database health check failed");
    return false;
  }
}
