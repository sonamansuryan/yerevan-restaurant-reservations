import { expect, test } from "vitest";

import { Prisma } from "../src/generated/prisma/client.ts";
import { isExclusionViolation } from "../src/lib/db-errors.ts";

// Builds the error Prisma throws, with the fields measured from real constraint violations.
function prismaError(code: string, sqlState: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Database error", {
    code,
    clientVersion: "test",
    meta: { driverAdapterError: { cause: { originalCode: sqlState } } },
  });
}

test("recognises an exclusion violation", () => {
  expect(isExclusionViolation(prismaError("P2039", "23P01"))).toBe(true);
});

test("ignores a CHECK violation, even though it has the same Prisma code", () => {
  expect(isExclusionViolation(prismaError("P2039", "23514"))).toBe(false);
});

test("ignores unique and foreign key violations", () => {
  expect(isExclusionViolation(prismaError("P2002", "23505"))).toBe(false);
  expect(isExclusionViolation(prismaError("P2003", "23503"))).toBe(false);
});

test("ignores a Prisma error with no driver details", () => {
  const error = new Prisma.PrismaClientKnownRequestError("Database error", {
    code: "P2039",
    clientVersion: "test",
  });

  expect(isExclusionViolation(error)).toBe(false);
});

test("ignores anything that isn't a Prisma error", () => {
  expect(isExclusionViolation(new Error("Something else"))).toBe(false);
  expect(isExclusionViolation("23P01")).toBe(false);
  expect(isExclusionViolation(null)).toBe(false);
});
