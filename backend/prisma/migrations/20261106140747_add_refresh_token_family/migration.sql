-- Hand-written: Prisma's version adds the column as NOT NULL in one step, which fails on a table
-- that already has rows.

-- Prisma doesn't wrap a migration in a transaction, so a failure partway would leave it half done.
-- This makes it all or nothing.
BEGIN;

-- Every refresh token from one sign-in shares a familyId, so reuse detection can end that one
-- session and leave the person's other sessions alone (PROJECT_PLAN.md §8.2).
ALTER TABLE "RefreshToken" ADD COLUMN "familyId" TEXT;

-- Each existing token becomes its own family. Its id is already unique and never null.
UPDATE "RefreshToken" SET "familyId" = "id";

-- From here on, every token must belong to a family.
ALTER TABLE "RefreshToken" ALTER COLUMN "familyId" SET NOT NULL;

-- Reuse detection and logout delete tokens by family.
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

COMMIT;
