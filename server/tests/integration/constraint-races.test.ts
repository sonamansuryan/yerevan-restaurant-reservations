// Real parallel connections, with no row locks in the way: this is the constraint on its own. The
// booking service adds row locks in Phase 6, and tests/integration/reservations.concurrency.test.ts
// will cover those.
import { describe, expect, test } from "vitest";

import type { Prisma } from "../../src/generated/prisma/client.ts";
import { isExclusionViolation } from "../../src/lib/db-errors.ts";
import { prisma } from "../../src/lib/prisma.ts";
import { activeBookings, at, booking, createFixture, databaseError } from "./helpers.ts";

class RollBack extends Error {}

interface OpenTransaction {
  commit: () => Promise<void>;
  rollBack: () => Promise<void>;
}

/** Runs some writes in a transaction, then holds it open until the test decides how it ends. */
async function openTransaction(
  work: (tx: Prisma.TransactionClient) => Promise<unknown>,
): Promise<OpenTransaction> {
  let markStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  let decide!: (commit: boolean) => void;
  const decision = new Promise<boolean>((resolve) => {
    decide = resolve;
  });

  const finished = prisma
    .$transaction(async (tx) => {
      await work(tx);
      markStarted();
      if (!(await decision)) throw new RollBack();
    })
    .catch((error: unknown) => {
      if (!(error instanceof RollBack)) throw error;
    });

  await started;
  return {
    commit: async () => {
      decide(true);
      await finished;
    },
    rollBack: async () => {
      decide(false);
      await finished;
    },
  };
}

/** What a write ended with, without failing the test: "accepted", or the error. */
const outcomeOf = (write: Promise<unknown>): Promise<unknown> =>
  write.then(
    () => "accepted",
    (error: unknown) => error,
  );

/** Waits until Postgres itself reports a write stuck behind a lock. */
async function waitForBlockedWrite(): Promise<void> {
  for (let attempt = 0; attempt < 500; attempt++) {
    const [row] = await prisma.$queryRaw<{ blocked: bigint }[]>`
      SELECT count(*) AS blocked FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock'
        AND query LIKE '%INSERT INTO%Reservation%'`;
    if (row && row.blocked > 0n) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("The second booking never waited for the first.");
}

describe("a second booking arrives while the first is unfinished", () => {
  test("it waits, then is rejected when the first commits", async () => {
    const fixture = await createFixture();
    const first = await openTransaction((tx) =>
      tx.reservation.create({ data: booking(fixture, at("19:30"), at("21:30")) }),
    );

    // This is why check-then-insert fails: a normal query can't see the unfinished row.
    expect(await activeBookings(fixture.tableId)).toBe(0);

    const second = outcomeOf(
      prisma.reservation.create({ data: booking(fixture, at("20:00"), at("22:00")) }),
    );
    await waitForBlockedWrite();
    await first.commit();

    expect(isExclusionViolation(await second)).toBe(true);
    expect(await activeBookings(fixture.tableId)).toBe(1);
  });

  test("it waits, then is accepted when the first rolls back", async () => {
    const fixture = await createFixture();
    const first = await openTransaction((tx) =>
      tx.reservation.create({ data: booking(fixture, at("19:30"), at("21:30")) }),
    );

    const second = outcomeOf(
      prisma.reservation.create({ data: booking(fixture, at("20:00"), at("22:00")) }),
    );
    await waitForBlockedWrite();
    await first.rollBack();

    expect(await second).toBe("accepted");
    expect(await activeBookings(fixture.tableId)).toBe(1);
  });
});

describe("a cancellation races a new booking for the same slot", () => {
  test("the new booking is accepted when the cancellation commits", async () => {
    const fixture = await createFixture();
    const existing = await prisma.reservation.create({
      data: booking(fixture, at("19:00"), at("21:00"), { status: "CONFIRMED" }),
    });
    const cancelling = await openTransaction((tx) =>
      tx.reservation.update({ where: { id: existing.id }, data: { status: "CANCELLED" } }),
    );

    const newBooking = outcomeOf(
      prisma.reservation.create({ data: booking(fixture, at("19:00"), at("21:00")) }),
    );
    await waitForBlockedWrite();
    await cancelling.commit();

    expect(await newBooking).toBe("accepted");
    expect(await activeBookings(fixture.tableId)).toBe(1);
  });

  test("the new booking is rejected when the cancellation rolls back", async () => {
    const fixture = await createFixture();
    const existing = await prisma.reservation.create({
      data: booking(fixture, at("19:00"), at("21:00"), { status: "CONFIRMED" }),
    });
    const cancelling = await openTransaction((tx) =>
      tx.reservation.update({ where: { id: existing.id }, data: { status: "CANCELLED" } }),
    );

    const newBooking = outcomeOf(
      prisma.reservation.create({ data: booking(fixture, at("19:00"), at("21:00")) }),
    );
    await waitForBlockedWrite();
    await cancelling.rollBack();

    expect(isExclusionViolation(await newBooking)).toBe(true);
    expect(await activeBookings(fixture.tableId)).toBe(1);
  });
});

describe("bookings fired at the same moment", () => {
  const RACERS = 8;
  const ROUNDS = Array.from({ length: 5 }, (_, index) => index + 1);

  test.each(ROUNDS)("round %i leaves exactly one active booking", async () => {
    const fixture = await createFixture();

    // Start times a minute apart: all of them overlap, but no two are identical.
    const results = await Promise.allSettled(
      Array.from({ length: RACERS }, (_, index) => {
        const startsAt = Date.parse(at("19:00")) + index * 60_000;
        const endsAt = startsAt + 2 * 3_600_000;
        return prisma.reservation.create({
          data: booking(fixture, new Date(startsAt).toISOString(), new Date(endsAt).toISOString()),
        });
      }),
    );

    const losers = results.flatMap((result) =>
      result.status === "rejected" ? [result.reason as unknown] : [],
    );
    expect(losers).toHaveLength(RACERS - 1);
    expect(await activeBookings(fixture.tableId)).toBe(1);

    // Inserts that collide at the same instant can deadlock instead, and Postgres aborts one. So a
    // loser gets either error, and anything else is a real problem.
    for (const loser of losers) {
      const isDeadlock = databaseError(loser).sqlState === "40P01";
      expect(isExclusionViolation(loser) || isDeadlock).toBe(true);
    }
  });
});
