-- Hiding a restaurant (PROJECT_PLAN.md 9.5): when Seghan's admin hides it, guests can't find,
-- book or favorite it, whatever its owner chooses. Null means not hidden, as for every restaurant
-- today. Prisma's own SQL, made with `prisma migrate diff`, without touching any database. One
-- statement, so it needs no transaction around it.
ALTER TABLE "Restaurant" ADD COLUMN     "hiddenAt" TIMESTAMP(3);
