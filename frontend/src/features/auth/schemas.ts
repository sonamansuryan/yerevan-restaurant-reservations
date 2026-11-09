import { z } from "zod";

// The server's rules and words (backend/src/modules/auth/auth.schemas.ts), so the browser can answer
// at once. The server still checks everything again: these only save a trip there and back.
const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter your email.")
  .max(254, "Enter a full email address.")
  .pipe(z.email("Enter a full email address."));

export const signInSchema = z.object({
  email,
  // Only "is it there?", so someone with an older, shorter password can still sign in.
  password: z.string().min(1, "Enter your password.").max(128, "Use 128 characters or fewer."),
});

export const signUpSchema = z.object({
  role: z.enum(["CUSTOMER", "OWNER"]),
  name: z.string().trim().min(1, "Enter your name.").max(100, "Use 100 characters or fewer."),
  email,
  // Never trimmed, because a space can be part of a password.
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(128, "Use 128 characters or fewer."),
});

/** What the sign-in fields hold. */
export type SignInFields = z.input<typeof signInSchema>;
/** What's sent: the same, with the email trimmed and lowercased. */
export type SignInRequest = z.output<typeof signInSchema>;

export type SignUpFields = z.input<typeof signUpSchema>;
export type SignUpRequest = z.output<typeof signUpSchema>;
export type SignUpRole = SignUpFields["role"];
