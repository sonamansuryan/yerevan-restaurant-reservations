import { defineConfig } from "vitest/config";

import { readDevelopmentUrl, testDatabaseUrlFrom } from "./tests/db/database-url.ts";
import { FAKE_ENV } from "./vitest.config.ts";

// npm run test:db -w backend: the tests in tests/db/, on real PostgreSQL. They need the Docker
// database running, and only ever use yerevan_test (tests/db/database-url.ts), which
// tests/db/global-setup.ts creates and migrates first. Everything but the database stays as fake
// as in npm test, so the app's own Prisma client reaches yerevan_test and nothing else.
export default defineConfig({
  test: {
    env: { ...FAKE_ENV, DATABASE_URL: testDatabaseUrlFrom(readDevelopmentUrl()) },
    include: ["tests/db/**/*.test.ts"],
    globalSetup: ["tests/db/global-setup.ts"],
    // The files share one database, so they run one after another.
    fileParallelism: false,
  },
});
