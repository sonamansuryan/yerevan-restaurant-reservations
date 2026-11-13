import { configDefaults, defineConfig } from "vitest/config";

// npm test. Fake values, so these tests never read your real backend/.env, reach a real service or
// need a database: the few that look rows up get the in-memory stand-in from tests/fake-prisma.ts.
// The tests that need real PostgreSQL are in tests/db/, and only npm run test:db runs them, with
// vitest.db.config.ts. It uses these same fake values for everything but the database.
export const FAKE_ENV = {
  NODE_ENV: "test",
  APP_URL: "http://localhost:5173",
  DATABASE_URL: "postgresql://test:not_a_real_password@localhost:5432/not_a_real_database",
  JWT_ACCESS_SECRET: "test-only-secret-that-is-long-enough-to-pass",
  GOOGLE_CLIENT_ID: "000000000000-testonlynotarealclient.apps.googleusercontent.com",
  GOOGLE_PLACES_API_KEY: "test",
  // Three different values, so a test can tell the public API key from the secret.
  CLOUDINARY_CLOUD_NAME: "test-cloud",
  CLOUDINARY_API_KEY: "000000000000000",
  CLOUDINARY_API_SECRET: "test-only-cloudinary-secret",
  RESEND_API_KEY: "test",
  EMAIL_FROM: "Test <test@example.com>",
  GEOAPIFY_API_KEY: "test",
  DEMO_PASSWORD: "test-only-demo-password",
  // Far above the real 10, because the auth tests sign in hundreds of times from one address.
  // tests/rate-limit.test.ts sets the real limit back for itself.
  SIGN_IN_ATTEMPTS_PER_MINUTE: "1000",
};

export default defineConfig({
  test: {
    env: FAKE_ENV,
    include: ["tests/**/*.test.ts"],
    // No test can reach Resend (tests/setup/outside-services.ts).
    setupFiles: ["tests/setup/outside-services.ts"],
    exclude: [...configDefaults.exclude, "tests/db/**"],
  },
});
