import { expect, test } from "vitest";

import { Prisma } from "../src/generated/prisma/client.ts";
import { isExclusionViolation, isRecordMissing, isUniqueViolation } from "../src/lib/db-errors.ts";

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

test("recognises a unique violation", () => {
  expect(isUniqueViolation(prismaError("P2002", "23505"))).toBe(true);
});

test("a unique violation isn't an exclusion or foreign key violation", () => {
  expect(isUniqueViolation(prismaError("P2039", "23P01"))).toBe(false);
  expect(isUniqueViolation(prismaError("P2003", "23503"))).toBe(false);
});

test("a unique violation has to be a Prisma error", () => {
  expect(isUniqueViolation(new Error("P2002"))).toBe(false);
  expect(isUniqueViolation("P2002")).toBe(false);
  expect(isUniqueViolation(null)).toBe(false);
});

// P2025 is what an update with an owner in its `where` gives for someone else's row, measured on
// the real database for task 4.2.
test("recognises an update that found no row to change", () => {
  const error = new Prisma.PrismaClientKnownRequestError("No record was found for an update.", {
    code: "P2025",
    clientVersion: "test",
  });

  expect(isRecordMissing(error)).toBe(true);
});

test("a missing row isn't a unique, exclusion or other violation, nor any other error", () => {
  expect(isRecordMissing(prismaError("P2002", "23505"))).toBe(false);
  expect(isRecordMissing(prismaError("P2039", "23P01"))).toBe(false);
  expect(isRecordMissing(new Error("P2025"))).toBe(false);
  expect(isRecordMissing(null)).toBe(false);
});
