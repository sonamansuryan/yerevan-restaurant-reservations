import { defineConfig } from "vitest/config";

// Fake values, so tests never read your real backend/.env or reach a real service. No test uses a
// database: tests that need one get the in-memory stand-in from tests/fake-prisma.ts.
const FAKE_ENV = {
  NODE_ENV: "test",
  APP_URL: "http://localhost:5173",
  DATABASE_URL: "postgresql://test:not_a_real_password@localhost:5432/not_a_real_database",
  JWT_ACCESS_SECRET: "test-only-secret-that-is-long-enough-to-pass",
  GOOGLE_CLIENT_ID: "000000000000-testonlynotarealclient.apps.googleusercontent.com",
  GOOGLE_PLACES_API_KEY: "test",
  CLOUDINARY_CLOUD_NAME: "test",
  CLOUDINARY_API_KEY: "test",
  CLOUDINARY_API_SECRET: "test",
  RESEND_API_KEY: "test",
  EMAIL_FROM: "Test <test@example.com>",
  DEMO_PASSWORD: "test-only-demo-password",
  // Far above the real 10, because the auth tests sign in hundreds of times from one address.
  // tests/rate-limit.test.ts sets the real limit back for itself.
  SIGN_IN_ATTEMPTS_PER_MINUTE: "1000",
};

export default defineConfig({
  test: {
    env: FAKE_ENV,
    include: ["tests/**/*.test.ts"],
  },
});
