// What the database tests share: emptying yerevan_test before each test, and the rows a booking
// needs. They use the app's own Prisma client, which npm run test:db points at yerevan_test.
import { prisma } from "../../src/lib/prisma.ts";

/**
 * Empties every table in yerevan_test, so each test starts from nothing. The database checks its
 * own name first, and refuses to empty any other, so even a wrong address can't empty yerevan_dev.
 */
export async function emptyTestDatabase(): Promise<void> {
  // One statement, so the check and the emptying run on the same connection. A DO block can't
  // take parameters, so the name is written in: it's TEST_DATABASE from database-url.ts.
  await prisma.$executeRaw`
    DO $$
    BEGIN
      IF current_database() <> 'yerevan_test' THEN
        RAISE EXCEPTION 'Refusing to empty %: database tests only use yerevan_test', current_database();
      END IF;
      EXECUTE (
        SELECT 'TRUNCATE ' || string_agg(format('%I', tablename), ', ') || ' CASCADE'
        FROM pg_tables
        WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
      );
    END
    $$`;
}

/** The rows a booking needs, by id. */
export interface TestRestaurant {
  guestId: string;
  restaurantId: string;
  /** Two tables for two to four guests. */
  t1: string;
  t2: string;
}

/** An owner, a guest, and Lori Smokehouse with two tables. */
export async function addRestaurant(): Promise<TestRestaurant> {
  const owner = await prisma.user.create({
    data: { email: "ani.owner@example.com", name: "Ani Sargsyan", role: "OWNER" },
  });
  const guest = await prisma.user.create({
    data: { email: "lilit@example.com", name: "Lilit Harutyunyan" },
  });
  const restaurant = await prisma.restaurant.create({
    data: {
      ownerId: owner.id,
      slug: "lori-smokehouse",
      name: "Lori Smokehouse",
      district: "KENTRON",
      address: "12 Test Street, Yerevan",
      isPublished: true,
    },
  });
  const table = (label: string): Promise<{ id: string }> =>
    prisma.table.create({
      data: { restaurantId: restaurant.id, label, capacity: 4, minCapacity: 2 },
      select: { id: true },
    });
  const t1 = await table("T1");
  const t2 = await table("T2");
  return { guestId: guest.id, restaurantId: restaurant.id, t1: t1.id, t2: t2.id };
}
