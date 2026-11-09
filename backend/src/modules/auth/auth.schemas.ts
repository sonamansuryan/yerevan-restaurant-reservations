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
  // ADMIN is left out on purpose: nobody can sign up as one.
  role: z
    .enum(["CUSTOMER", "OWNER"], { error: "Choose a guest or restaurant account." })
    .default("CUSTOMER"),
});

export const loginSchema = z.object({
  email,
  // Only "is it there?", so someone with an old, shorter password can still sign in.
  password: z
    .string({ error: "Enter your password." })
    .min(1, "Enter your password.")
    .max(128, "Use 128 characters or fewer."),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
