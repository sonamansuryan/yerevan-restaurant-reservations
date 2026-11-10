import type { Prisma } from "../../generated/prisma/client.ts";
import { verifyGoogleIdToken } from "../../integrations/google/id-token.ts";
import type { GoogleAccount } from "../../integrations/google/id-token.ts";
import { isUniqueViolation } from "../../lib/db-errors.ts";
import { ConflictError, ForbiddenError, UnauthorizedError } from "../../lib/errors.ts";
import { hashPassword, verifyPassword } from "../../lib/password.ts";
import { prisma } from "../../lib/prisma.ts";
import type { GoogleInput, LoginInput, RegisterInput } from "./auth.schemas.ts";

// Everything about a user that may leave the server. The password hash is never one of these.
export const publicFields = { id: true, email: true, name: true, phone: true, role: true } as const;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicFields }>;

export function toPublicUser({ id, email, name, phone, role }: PublicUser): PublicUser {
  return { id, email, name, phone, role };
}

export async function registerUser({
  name,
  email,
  password,
  role,
}: RegisterInput): Promise<PublicUser> {
  const passwordHash = await hashPassword(password);

  try {
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role },
      select: publicFields,
    });
    return toPublicUser(user);
  } catch (err) {
    // There's no "does this email exist?" check first, because two sign-ups at once could both
    // pass it. The unique index decides, so exactly one of them wins.
    if (isUniqueViolation(err)) throw new ConflictError("EMAIL_TAKEN");
    throw err;
  }
}

/** Returns the user if the email and password match. Every other case gets the same error. */
export async function verifyCredentials({ email, password }: LoginInput): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { ...publicFields, passwordHash: true },
  });

  const matches = await verifyPassword(user?.passwordHash, password);
  if (!user || !matches) throw new UnauthorizedError("INVALID_CREDENTIALS");

  return toPublicUser(user);
}

export interface GoogleSignIn {
  user: PublicUser;
  /** True when this sign-in created the account. */
  created: boolean;
}

/**
 * Signs someone in with a Google ID token, and creates their account the first time. Accounts are
 * found by Google's id, never by email:
 * 1. an account with this Google id → sign in
 * 2. otherwise Google must have verified the email, because the new account takes it as its own
 * 3. a free email → a new account, with no password
 * 4. an email that already has an account → refused, and that account isn't touched
 */
export async function signInWithGoogle({ credential, role }: GoogleInput): Promise<GoogleSignIn> {
  // Google is asked first, before anything touches the database.
  const google = await verifyGoogleIdToken(credential);

  const linked = await findByGoogleId(google.googleId);
  if (linked) return { user: linked, created: false };

  if (!google.emailVerified) throw new ForbiddenError("GOOGLE_EMAIL_UNVERIFIED");

  try {
    const user = await prisma.user.create({
      data: {
        googleId: google.googleId,
        // Lowercased like a typed email, because the User_email_lowercase constraint requires it.
        email: google.email.toLowerCase(),
        name: accountName(google),
        role,
      },
      select: publicFields,
    });
    return { user: toPublicUser(user), created: true };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;

    // A double click sends the same Google account twice. The other request has just created the
    // account, so this one is simply a sign-in.
    const raced = await findByGoogleId(google.googleId);
    if (raced) return { user: raced, created: false };

    // The email belongs to another account. Sign-up doesn't verify emails, so a match proves
    // nothing: someone could have registered this address with their own password, and linking
    // would let them read the real owner's bookings. So nothing is linked, and nothing changes.
    throw new ConflictError("GOOGLE_EMAIL_TAKEN");
  }
}

async function findByGoogleId(googleId: string): Promise<PublicUser | null> {
  const user = await prisma.user.findUnique({ where: { googleId }, select: publicFields });
  return user ? toPublicUser(user) : null;
}

/** The Google account's name, held to sign-up's rules, or the email's first part if there's none. */
function accountName({ name, email }: GoogleAccount): string {
  // Postgres can't store a null character, and sign-up allows 100 characters.
  const cleaned = (name ?? "").replaceAll("\0", "").trim().slice(0, 100).trim();
  return cleaned || email.slice(0, email.indexOf("@"));
}

/** The signed-in person's current details, which may be newer than their access token. */
export async function getCurrentUser(id: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id }, select: publicFields });

  // An access token can outlive its account by up to 15 minutes.
  if (!user) throw new UnauthorizedError();

  return toPublicUser(user);
}
