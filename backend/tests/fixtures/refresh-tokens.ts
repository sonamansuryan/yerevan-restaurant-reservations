// A row from the RefreshToken table, for tests that script Prisma's answers by hand.
import { storedUser } from "./users.ts";

/** Typed `never` so it fits any mocked Prisma result, which each has its own narrow type. */
export function storedRefreshToken(extra: object = {}): never {
  const user = storedUser();
  return {
    id: "token-1",
    userId: user.id,
    familyId: "family-1",
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    user,
    ...extra,
  } as never;
}

/** A token retired long ago, so presenting it sets off reuse detection. */
export const replayedRefreshToken = (): never =>
  storedRefreshToken({ revokedAt: new Date(Date.now() - 60_000) });
