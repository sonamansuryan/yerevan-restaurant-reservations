import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Fake values, so tests never read your real server/.env or reach a real service.
    // The password is not a real one, and nothing connects with it yet.
    env: {
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
    },
  },
});
