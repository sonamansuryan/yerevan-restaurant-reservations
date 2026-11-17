// Fills yerevan_dev, or the public demo's seghan_demo, with demo data. It only ever adds rows that
// are missing: there are no deletes, and an existing row is never changed, so running it again does
// nothing. Every demo account signs in with DEMO_PASSWORD, apart from seghan_demo's admin, who uses
// DEMO_ADMIN_PASSWORD (demoPasswords() in seed-data.ts).
import { env } from "../src/config/env.ts";
import type { Prisma } from "../src/generated/prisma/client.ts";
import { hashPassword, verifyPassword } from "../src/lib/password.ts";
import { prisma } from "../src/lib/prisma.ts";
import {
  demoPasswords,
  isSeedDatabase,
  LOCAL_DATABASE,
  openingHoursFor,
  passwordFor,
  planReservations,
  RESERVATIONS,
  RESTAURANTS,
  TIME_ZONE,
  USERS,
} from "./seed-data.ts";
import type { DemoPasswords } from "./seed-data.ts";

// Prisma can't see these, so it can't warn us if one is missing (PROJECT_PLAN.md §7.3).
const REQUIRED_CONSTRAINTS = [
  "Reservation_no_overlap",
  "Reservation_valid_range",
  "Reservation_party_size",
  "BlockedPeriod_valid_range",
  "Table_capacity",
  "OpeningHour_day",
  "OpeningHour_range",
  "Review_rating",
  "Restaurant_price_level",
  "Restaurant_slot_interval",
  "Restaurant_reservation_duration",
  "User_email_lowercase",
];

/** Stops the seed on any database but the two it may write to, and names the one it's on. */
async function assertSeedDatabase(): Promise<string> {
  const [row] = await prisma.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
  if (!row || !isSeedDatabase(row.name)) {
    throw new Error(`Refusing to seed "${row?.name}": only yerevan_dev and seghan_demo.`);
  }
  return row.name;
}

/**
 * Lists everything that doesn't match the demo data. An empty database is fine, and so is one that
 * holds only the demo data. Anything else could be real work, so the seed leaves it alone.
 */
async function findProblems(database: string, passwords: DemoPasswords): Promise<string[]> {
  const problems: string[] = [];

  const constraints = await prisma.$queryRaw<{ name: string }[]>`
    SELECT conname::text AS name FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace AND contype IN ('c', 'x')`;
  const constraintNames = new Set(constraints.map(({ name }) => name));
  for (const name of REQUIRED_CONSTRAINTS) {
    if (!constraintNames.has(name)) problems.push(`Missing constraint: ${name}`);
  }

  const users = await prisma.user.findMany({
    select: { email: true, role: true, passwordHash: true },
  });
  // A demo user made before its password existed, or with an older one, can't sign in with it.
  // The seed never changes an existing row, so the passwords must be the ones it was seeded with.
  const withoutDemoPassword: string[] = [];
  for (const { email, role, passwordHash } of users) {
    const expected = USERS.find((user) => user.email === email);
    if (!expected) problems.push(`Unexpected user: ${email}`);
    else if (expected.role !== role) problems.push(`User ${email} has a different role: ${role}`);
    else if (!(await verifyPassword(passwordHash, passwordFor(role, passwords)))) {
      withoutDemoPassword.push(email);
    }
  }
  if (withoutDemoPassword.length > 0) {
    // Only the local database may be rebuilt: the public demo is never reset.
    const fix =
      database === LOCAL_DATABASE
        ? "Rebuild the database with db:reset, then run db:seed again."
        : "Use the passwords it was first seeded with.";
    problems.push(
      `These demo users don't sign in with their demo password: ${withoutDemoPassword.join(", ")}. ${fix}`,
    );
  }

  const restaurants = await prisma.restaurant.findMany({
    select: { slug: true, owner: { select: { email: true } } },
  });
  for (const { slug, owner } of restaurants) {
    const expected = RESTAURANTS.find((restaurant) => restaurant.slug === slug);
    if (!expected) problems.push(`Unexpected restaurant: ${slug}`);
    else if (expected.ownerEmail !== owner.email) {
      problems.push(`Restaurant ${slug} has a different owner: ${owner.email}`);
    }
  }

  const tables = await prisma.table.findMany({
    select: { label: true, restaurant: { select: { slug: true } } },
  });
  for (const { label, restaurant } of tables) {
    const expected = RESTAURANTS.find(({ slug }) => slug === restaurant.slug);
    if (!expected?.tables.some((table) => table.label === label)) {
      problems.push(`Unexpected table: ${restaurant.slug} ${label}`);
    }
  }

  const hours = await prisma.openingHour.findMany({
    select: {
      dayOfWeek: true,
      opensAt: true,
      closesAt: true,
      restaurant: { select: { slug: true } },
    },
  });
  for (const { dayOfWeek, opensAt, closesAt, restaurant } of hours) {
    const expected = RESTAURANTS.find(({ slug }) => slug === restaurant.slug);
    const known =
      expected &&
      openingHoursFor(expected).some(
        (hour) =>
          hour.dayOfWeek === dayOfWeek && hour.opensAt === opensAt && hour.closesAt === closesAt,
      );
    if (!known) {
      problems.push(`Unexpected opening hours: ${restaurant.slug} day ${dayOfWeek}, ${opensAt}`);
    }
  }

  const reservations = await prisma.reservation.findMany({
    select: {
      id: true,
      user: { select: { email: true } },
      table: { select: { label: true, restaurant: { select: { slug: true } } } },
    },
  });
  for (const { id, user, table } of reservations) {
    const expected = RESERVATIONS.find((reservation) => reservation.id === id);
    if (!expected) problems.push(`Unexpected reservation: ${id}`);
    else if (
      expected.customer !== user.email ||
      expected.table !== table.label ||
      expected.restaurant !== table.restaurant.slug
    ) {
      problems.push(`Reservation ${id} belongs to a different table or customer`);
    }
  }

  // The seed creates none of these, so any row at all was made by someone else.
  const otherRows = {
    Review: await prisma.review.count(),
    RestaurantPhoto: await prisma.restaurantPhoto.count(),
    BlockedPeriod: await prisma.blockedPeriod.count(),
    RefreshToken: await prisma.refreshToken.count(),
    Favorite: await prisma.favorite.count(),
  };
  for (const [table, count] of Object.entries(otherRows)) {
    if (count > 0) problems.push(`Unexpected rows in ${table}: ${count}`);
  }

  return problems;
}

/** The hash each kind of demo account gets, made once from its password. */
interface DemoHashes {
  everyone: string;
  admin: string;
}

async function writeSeedData(tx: Prisma.TransactionClient, hashes: DemoHashes): Promise<void> {
  const userIds = new Map<string, string>();
  for (const { email, name, phone, role } of USERS) {
    // `update: {}` is what makes this safe to repeat: a row that already exists stays as it is.
    const passwordHash = passwordFor(role, hashes);
    const user = await tx.user.upsert({
      where: { email },
      update: {},
      create: { email, name, phone, role, passwordHash },
    });
    userIds.set(email, user.id);
  }

  const tableIds = new Map<string, { id: string; restaurantId: string }>();
  for (const restaurant of RESTAURANTS) {
    const ownerId = userIds.get(restaurant.ownerEmail);
    if (!ownerId) throw new Error(`Unknown owner: ${restaurant.ownerEmail}`);

    const { id: restaurantId } = await tx.restaurant.upsert({
      where: { slug: restaurant.slug },
      update: {},
      create: {
        ownerId,
        slug: restaurant.slug,
        name: restaurant.name,
        description: restaurant.description,
        cuisines: restaurant.cuisines,
        district: restaurant.district,
        address: restaurant.address,
        phone: restaurant.phone,
        priceLevel: restaurant.priceLevel,
        timezone: TIME_ZONE,
        slotIntervalMin: restaurant.slotIntervalMin,
        reservationDurationMin: restaurant.reservationDurationMin,
        isPublished: restaurant.isPublished,
      },
    });

    for (const table of restaurant.tables) {
      const { id } = await tx.table.upsert({
        where: { restaurantId_label: { restaurantId, label: table.label } },
        update: {},
        create: { ...table, restaurantId },
      });
      tableIds.set(`${restaurant.slug}/${table.label}`, { id, restaurantId });
    }

    for (const hour of openingHoursFor(restaurant)) {
      const { dayOfWeek, opensAt } = hour;
      await tx.openingHour.upsert({
        where: { restaurantId_dayOfWeek_opensAt: { restaurantId, dayOfWeek, opensAt } },
        update: {},
        create: { ...hour, restaurantId },
      });
    }
  }

  // upsert, not createMany with skipDuplicates: that one would silently drop an overlapping
  // booking, while upsert lets the exclusion constraint reject it with an error.
  for (const reservation of planReservations(new Date())) {
    const table = tableIds.get(`${reservation.restaurant}/${reservation.table}`);
    const userId = userIds.get(reservation.customer);
    if (!table || !userId) throw new Error(`Unknown table or customer: ${reservation.id}`);

    await tx.reservation.upsert({
      where: { id: reservation.id },
      update: {},
      create: {
        id: reservation.id,
        // Copied from the table row, as in the booking service (PROJECT_PLAN.md §4.4).
        restaurantId: table.restaurantId,
        tableId: table.id,
        userId,
        partySize: reservation.partySize,
        startsAt: reservation.startsAt,
        endsAt: reservation.endsAt,
        status: reservation.status,
        specialRequests: reservation.specialRequests,
        cancelledBy: reservation.cancelledBy,
        cancellationReason: reservation.cancellationReason,
        cancelledAt: reservation.cancelledAt,
        createdAt: reservation.createdAt,
      },
    });
  }
}

async function main(): Promise<void> {
  const database = await assertSeedDatabase();
  // Checked before anything is written: without them, nobody could sign in to the demo accounts.
  const passwords = demoPasswords(database, env.DEMO_PASSWORD, env.DEMO_ADMIN_PASSWORD);

  const problems = await findProblems(database, passwords);
  if (problems.length > 0) {
    throw new Error(`Nothing was written, because of:\n- ${problems.join("\n- ")}`);
  }

  // Hashed once each, before the transaction: argon2 is slow on purpose, and a transaction should
  // stay as short as it can.
  const hashes = {
    everyone: await hashPassword(passwords.everyone),
    admin: await hashPassword(passwords.admin),
  };

  // One transaction, so a failure partway through leaves nothing half-written. It runs over a
  // hundred statements, each waiting for a round trip to the database: nothing locally, but around
  // 0.1 s to the public demo's database (PROJECT_PLAN.md 10.1). So it gets two minutes, not the
  // app's 5 seconds.
  await prisma.$transaction((tx) => writeSeedData(tx, hashes), { timeout: 120_000 });

  const counts = {
    users: await prisma.user.count(),
    restaurants: await prisma.restaurant.count(),
    tables: await prisma.table.count(),
    openingHours: await prisma.openingHour.count(),
    reservations: await prisma.reservation.count(),
  };
  console.log(`Seeded ${database}:`, counts);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
