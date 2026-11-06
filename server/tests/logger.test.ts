import { pino } from "pino";
import type { Logger } from "pino";
import { expect, test } from "vitest";

import { createLogger, safeError } from "../src/lib/logger.ts";
import { prisma } from "../src/lib/prisma.ts";

const PASSWORD = "my-very-secret-password";
const HASH = "$argon2id$v=19$m=65536,t=3,p=4$not-a-real-hash";
// JSON.parse quotes short text in full, and only the start of longer text.
const SHORT_PASSWORD = "hunter2-secret";

function capture(): { lines: string[]; logger: Logger } {
  const lines: string[] = [];
  return { lines, logger: createLogger("info", { write: (line) => void lines.push(line) }) };
}

/** A real error from Prisma, which checks the call before it needs a database. */
async function prismaValidationError(): Promise<Error> {
  try {
    await prisma.user.create({
      data: { email: "a@example.com", name: 42 as unknown as string, passwordHash: HASH },
    });
  } catch (error) {
    return error as Error;
  }
  throw new Error("Expected Prisma to refuse this call.");
}

/** A real error from JSON.parse, which quotes the text it couldn't read. */
function jsonError(): Error {
  try {
    JSON.parse(SHORT_PASSWORD);
  } catch (error) {
    return error as Error;
  }
  throw new Error("Expected JSON.parse to refuse this text.");
}

// These two show the danger is real. If they fail, the tests below prove less than they seem to.
test("pino's default serializer would log the hash in a real Prisma error", async () => {
  const logged = JSON.stringify(pino.stdSerializers.err(await prismaValidationError()));

  expect(logged).toContain(HASH);
});

test("pino's default serializer would log the password in a real JSON error", () => {
  expect(JSON.stringify(pino.stdSerializers.err(jsonError()))).toContain(SHORT_PASSWORD);
});

test("a real Prisma error keeps its type and location, and loses the hash", async () => {
  const safe = safeError(await prismaValidationError());

  expect(safe.type).toBe("PrismaClientValidationError");
  expect(safe.stack.length).toBeGreaterThan(0);
  expect(JSON.stringify(safe)).not.toContain("not-a-real-hash");
});

test("a real JSON error keeps its type and location, and loses the password", () => {
  const safe = safeError(jsonError());

  expect(safe.type).toBe("SyntaxError");
  expect(safe.stack.join("\n")).toContain("logger.test.ts");
  expect(JSON.stringify(safe)).not.toContain(SHORT_PASSWORD);
});

test("only the type, code and location are copied", () => {
  const error = Object.assign(new Error(PASSWORD), {
    code: "P2025",
    body: PASSWORD,
    meta: { passwordHash: HASH },
    cause: new Error(PASSWORD),
  });

  const safe = safeError(error);

  expect(Object.keys(safe).sort()).toEqual(["code", "stack", "type"]);
  expect(safe.code).toBe("P2025");
  expect(JSON.stringify(safe)).not.toContain(PASSWORD);
  expect(JSON.stringify(safe)).not.toContain("not-a-real-hash");
});

test("it also works on pino's plain copy of an error, which is what pino-http passes", () => {
  const copy = pino.stdSerializers.err(new TypeError(PASSWORD));

  const safe = safeError(copy);

  expect(safe.type).toBe("TypeError");
  expect(JSON.stringify(safe)).not.toContain(PASSWORD);
});

test.each([[PASSWORD], [42], [null], [undefined]])("a thrown %j copies nothing", (value) => {
  expect(safeError(value)).toEqual({ type: "Unknown", stack: [] });
});

test("logging an error with text, as the health check does, keeps that text", () => {
  const { lines, logger } = capture();

  logger.error({ err: new Error(PASSWORD) }, "Database health check failed");

  expect(lines).toHaveLength(1);
  expect(lines[0]).toContain("Database health check failed");
  expect(lines[0]).not.toContain(PASSWORD);
});

test("logging an error with no text never uses its message as the text", () => {
  const { lines, logger } = capture();

  logger.error(new Error(PASSWORD));
  logger.error({ err: new Error(PASSWORD) });

  expect(lines).toHaveLength(2);
  for (const line of lines) {
    expect(line).toContain("Unexpected error");
    expect(line).not.toContain(PASSWORD);
  }
});

test("ordinary log lines are left alone", () => {
  const { lines, logger } = capture();

  logger.info("API listening");
  logger.info({ port: 4000 }, "Started");

  expect(lines[0]).toContain("API listening");
  expect(lines[1]).toContain("Started");
  expect(lines[1]).toContain('"port":4000');
});
