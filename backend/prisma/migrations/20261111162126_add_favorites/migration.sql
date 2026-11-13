-- Favorites (PROJECT_PLAN.md 9.2): the restaurants each guest saves. Prisma's own SQL, made with
-- `prisma migrate diff` from the schema before and after, without touching any database.

-- Prisma doesn't wrap a migration in a transaction, so a failure partway would leave it half done.
-- This makes it all or nothing.
BEGIN;

-- The pair is the key, so a guest saves a restaurant at most once.
CREATE TABLE "Favorite" (
    "userId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("userId","restaurantId")
);

-- My favorites lists a guest's saved restaurants, newest first.
CREATE INDEX "Favorite_userId_createdAt_idx" ON "Favorite"("userId", "createdAt");

ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
