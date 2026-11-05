// Runs in every test process, before any test in the file. The global setup checked its own
// connection, and this checks the one the tests really use.
import { afterAll, beforeAll } from "vitest";

import { prisma } from "../../src/lib/prisma.ts";
import { TEST_DATABASE } from "./test-database.ts";

beforeAll(async () => {
  const [row] = await prisma.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
  if (row?.name !== TEST_DATABASE) {
    throw new Error(`Refusing to run tests against "${row?.name}". Use ${TEST_DATABASE}.`);
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});
