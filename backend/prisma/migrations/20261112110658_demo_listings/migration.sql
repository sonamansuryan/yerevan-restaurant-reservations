-- Demo listings (PROJECT_PLAN.md 9.7): real Yerevan restaurants listed from OpenStreetMap, with
-- photos from Wikimedia Commons, that aren't on Seghan and can't be booked. Prisma's own SQL, made
-- with `prisma migrate diff` from the schema before and after, without touching any database.
-- Every restaurant there today stays as it is: not a demo listing, with its price level.

-- Prisma doesn't wrap a migration in a transaction, so a failure partway would leave it half done.
-- This makes it all or nothing.
BEGIN;

-- A demo listing names its OpenStreetMap place, which is also how the import finds it again. Its
-- price level stays empty, as no source gives one; Restaurant_price_level still allows only 1 to 4.
ALTER TABLE "Restaurant" ADD COLUMN     "isDemoListing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "osmRef" TEXT,
ALTER COLUMN "priceLevel" DROP NOT NULL;

-- A photo from Wikimedia Commons carries its author and license, and its page there.
ALTER TABLE "RestaurantPhoto" ADD COLUMN     "credit" TEXT,
ADD COLUMN     "creditUrl" TEXT;

CREATE UNIQUE INDEX "Restaurant_osmRef_key" ON "Restaurant"("osmRef");

COMMIT;
