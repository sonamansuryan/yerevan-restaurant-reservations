// Loads backend/.env into process.env. Values that are already set win, so a hosting platform can
// provide them instead. In production there's no .env file, and this quietly does nothing.
import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Every value in process.env is a string, so coerce turns "4000" into the number 4000.
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  APP_URL: z.url(),
  DATABASE_URL: z.url(),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, "must be at least 32 characters. Generate one with: openssl rand -base64 32"),
  // The Client ID of our Google Cloud web client. Every Google sign-in token must be made for it.
  // Checking its shape catches a placeholder left in .env, or the Client Secret pasted by mistake.
  GOOGLE_CLIENT_ID: z
    .string()
    .regex(
      /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/,
      "must be the Client ID from Google Cloud, ending in .apps.googleusercontent.com",
    ),
  // Sign-in and sign-up tries per IP address per minute (src/middleware/rateLimit.ts). Tests raise
  // it in vitest.config.ts, because they sign in far more often than a person does.
  SIGN_IN_ATTEMPTS_PER_MINUTE: z.coerce.number().int().min(1).default(10),
  GOOGLE_PLACES_API_KEY: z.string().min(1),
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1),
  // The map on each restaurant's page (Geoapify, free, no card). Optional: without it, or left
  // empty, the server starts, and pages show the address and its link without a map.
  GEOAPIFY_API_KEY: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(1).optional(),
  ),
  // Only the seed reads this: every demo account gets it as its password. It's optional, so the
  // server starts without it, and it follows the sign-up rule of 8 to 128 characters.
  DEMO_PASSWORD: z
    .string()
    .min(8, "must be at least 8 characters, like any account password")
    .max(128, "must be at most 128 characters, like any account password")
    .optional(),
});

const result = envSchema.safeParse(process.env);

// Fail fast: stop at startup with a clear message instead of failing later, mid-request.
// The message names variables but never shows their values, because some of them are secrets.
if (!result.success) {
  throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
}

export const env = result.data;
