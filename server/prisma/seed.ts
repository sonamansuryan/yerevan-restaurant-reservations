// Fills yerevan_dev with demo data. It only ever adds rows that are missing: there are no deletes,
// and an existing row is never changed, so running it again does nothing.
import type { Prisma } from "../src/generated/prisma/client.ts";
import { prisma } from "../src/lib/prisma.ts";
import {
  openingHoursFor,
  planReservations,
  RESERVATIONS,
  RESTAURANTS,
  SEED_DATABASE,
  TIME_ZONE,
  USERS,
} from "./seed-data.ts";

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

/** Stops the seed on anything but the one database it's allowed to write to. */
async function assertSeedDatabase(): Promise<void> {
  const [row] = await prisma.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
  if (row?.name !== SEED_DATABASE) {
    throw new Error(`Refusing to seed "${row?.name}": only ${SEED_DATABASE} may be seeded.`);
  }
}

/**
 * Lists everything that doesn't match the demo data. An empty database is fine, and so is one that
 * holds only the demo data. Anything else could be real work, so the seed leaves it alone.
 */
async function findProblems(): Promise<string[]> {
  const problems: string[] = [];

  const constraints = await prisma.$queryRaw<{ name: string }[]>`
    SELECT conname::text AS name FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace AND contype IN ('c', 'x')`;
  const constraintNames = new Set(constraints.map(({ name }) => name));
  for (const name of REQUIRED_CONSTRAINTS) {
    if (!constraintNames.has(name)) problems.push(`Missing constraint: ${name}`);
  }

  const users = await prisma.user.findMany({ select: { email: true, role: true } });
  for (const { email, role } of users) {
    const expected = USERS.find((user) => user.email === email);
    if (!expected) problems.push(`Unexpected user: ${email}`);
    else if (expected.role !== role) problems.push(`User ${email} has a different role: ${role}`);
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
  };
  for (const [table, count] of Object.entries(otherRows)) {
    if (count > 0) problems.push(`Unexpected rows in ${table}: ${count}`);
  }

  return problems;
}

async function writeSeedData(tx: Prisma.TransactionClient): Promise<void> {
  const userIds = new Map<string, string>();
  for (const { email, name, phone, role } of USERS) {
    // `update: {}` is what makes this safe to repeat: a row that already exists stays as it is.
    const user = await tx.user.upsert({
      where: { email },
      update: {},
      create: { email, name, phone, role },
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
  await assertSeedDatabase();

  const problems = await findProblems();
  if (problems.length > 0) {
    throw new Error(`Nothing was written, because of:\n- ${problems.join("\n- ")}`);
  }

  // One transaction, so a failure partway through leaves nothing half-written. The timeout is
  // longer than the app's 5 seconds because this runs well over a hundred statements.
  await prisma.$transaction(writeSeedData, { timeout: 30_000 });

  const counts = {
    users: await prisma.user.count(),
    restaurants: await prisma.restaurant.count(),
    tables: await prisma.table.count(),
    openingHours: await prisma.openingHour.count(),
    reservations: await prisma.reservation.count(),
  };
  console.log(`Seeded ${SEED_DATABASE}:`, counts);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
