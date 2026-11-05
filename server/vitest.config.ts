import { defineConfig } from "vitest/config";

import { readTestDatabaseUrl } from "./tests/integration/test-database.ts";

// Fake values, so tests never read your real server/.env or reach a real service.
const FAKE_ENV = {
  NODE_ENV: "test",
  APP_URL: "http://localhost:5173",
  DATABASE_URL: "postgresql://test:not_a_real_password@localhost:5432/yerevan_test",
  JWT_ACCESS_SECRET: "test-only-secret-that-is-long-enough-to-pass",
  GOOGLE_CLIENT_ID: "test",
  GOOGLE_PLACES_API_KEY: "test",
  CLOUDINARY_CLOUD_NAME: "test",
  CLOUDINARY_API_KEY: "test",
  CLOUDINARY_API_SECRET: "test",
  RESEND_API_KEY: "test",
  EMAIL_FROM: "Test <test@example.com>",
};

export default defineConfig({
  test: {
    env: FAKE_ENV,
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["tests/*.test.ts"] },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/integration/global-setup.ts"],
          setupFiles: ["tests/integration/setup.ts"],
          // Only this group gets a real database. If the URL is missing or wrong, the global setup
          // stops the run before any test starts.
          env: { DATABASE_URL: readTestDatabaseUrl() ?? FAKE_ENV.DATABASE_URL },
          testTimeout: 30_000,
        },
      },
    ],
  },
});
