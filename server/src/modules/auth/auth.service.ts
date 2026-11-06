import type { Prisma } from "../../generated/prisma/client.ts";
import { isUniqueViolation } from "../../lib/db-errors.ts";
import { ConflictError, UnauthorizedError } from "../../lib/errors.ts";
import { hashPassword, verifyPassword } from "../../lib/password.ts";
import { prisma } from "../../lib/prisma.ts";
import type { LoginInput, RegisterInput } from "./auth.schemas.ts";

// Everything about a user that may leave the server. The password hash is never one of these.
const publicFields = { id: true, email: true, name: true, phone: true, role: true } as const;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicFields }>;

function toPublicUser({ id, email, name, phone, role }: PublicUser): PublicUser {
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
