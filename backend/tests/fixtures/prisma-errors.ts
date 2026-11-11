// Errors as Prisma throws them, with the fields measured from real constraint violations.
import { Prisma } from "../../src/generated/prisma/client.ts";

/** P2039 is a constraint's refusal: 23P01 for an EXCLUDE constraint, 23514 for a CHECK. */
export function prismaError(code: string, sqlState: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Database error", {
    code,
    clientVersion: "test",
    meta: { driverAdapterError: { cause: { originalCode: sqlState } } },
  });
}
