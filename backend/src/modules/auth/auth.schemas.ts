import { z } from "zod";

// Lowercased here because the unique index is case-sensitive, and the User_email_lowercase
// constraint refuses anything else. So Ani@Example.com and ani@example.com are one account.
const email = z
  .string({ error: "Enter your email." })
  .trim()
  .toLowerCase()
  .min(1, "Enter your email.")
  .max(254, "Enter a full email address.")
  .pipe(z.email("Enter a full email address."));

// Never trimmed, because a space can be part of a password.
const newPassword = z
  .string({ error: "Use at least 8 characters." })
  .min(8, "Use at least 8 characters.")
  .max(128, "Use 128 characters or fewer.");

// For a new account, by email or Google. ADMIN is left out on purpose: nobody can sign up as one.
const role = z
  .enum(["CUSTOMER", "OWNER"], { error: "Choose a guest or restaurant account." })
  .default("CUSTOMER");

export const registerSchema = z.object({
  name: z
    .string({ error: "Enter your name." })
    .trim()
    .min(1, "Enter your name.")
    .max(100, "Use 100 characters or fewer.")
    // Postgres can't store a null character, so this would otherwise end as a server error.
    .refine((value) => !value.includes("\0"), "Enter your name."),
  email,
  password: newPassword,
  role,
});

export const loginSchema = z.object({
  email,
  // Only "is it there?", so someone with an old, shorter password can still sign in.
  password: z
    .string({ error: "Enter your password." })
    .min(1, "Enter your password.")
    .max(128, "Use 128 characters or fewer."),
});

// There's no field to show this under, so it's what the page shows if Google's token is unusable.
const googleTokenProblem = "We couldn’t sign you in with Google. Please try again.";

export const googleSchema = z.object({
  // Google's ID token, as its button hands it over: three base64url parts, about 1 KB. Checking
  // the shape first means junk never reaches Google's library.
  credential: z
    .string({ error: googleTokenProblem })
    .max(4096, googleTokenProblem)
    .regex(/^[\w-]+\.[\w-]+\.[\w-]+$/, googleTokenProblem),
  // Only used when this sign-in creates the account. Someone who has one keeps their role.
  role,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleInput = z.infer<typeof googleSchema>;
