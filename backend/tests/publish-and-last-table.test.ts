// Publishing a restaurant and switching off its last active table at the same moment, played out
// step by step in both orders. Each runs in its own transaction, and both take the restaurant's row
// lock: switching a table off takes it after the table's, publishing takes it first.
//
// The database here is a stand-in that does two things PostgreSQL does: one transaction at a time
// holds a row's lock while the others wait their turn, and a transaction's changes reach the others
// only once it commits (READ COMMITTED, PostgreSQL's default). It proves the services follow the
// protocol. That PostgreSQL itself keeps the order without deadlocks is checked on real PostgreSQL,
// and becomes database test 8 once yerevan_test exists (PROJECT_PLAN.md §5.4).
import { beforeEach, describe, expect, test, vi } from "vitest";

import { prisma } from "../src/lib/prisma.ts";
import { updateRestaurant } from "../src/modules/restaurants/owner.service.ts";
import { updateTable } from "../src/modules/tables/tables.service.ts";
import { ownedRow } from "./fixtures/restaurants.ts";
import { tableRow } from "./fixtures/tables.ts";
import { ani } from "./fixtures/users.ts";

vi.mock("../src/lib/prisma.ts", () => ({
  prisma: { $transaction: vi.fn() },
  isDatabaseReachable: vi.fn(),
}));

const RESTAURANT = ownedRow().id;
const T1 = "4f3e2d1c-0b9a-4876-9543-210fedcba987";
const T2 = "5a4b3c2d-1e0f-4a98-8b76-543210fedcba";
const NOW = new Date("2026-11-10T10:00:00.000Z");

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
}

function deferred(): Deferred {
  let resolve = (): void => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** One row's lock: one transaction holds it, and the others wait their turn, first come first. */
class RowLock {
  private holder: object | null = null;
  private readonly queue: { tx: object; grant: () => void }[] = [];

  acquire(tx: object): Promise<void> {
    if (this.holder === null || this.holder === tx) {
      this.holder = tx;
      return Promise.resolve();
    }
    return new Promise((grant) => this.queue.push({ tx, grant }));
  }

  get waiting(): number {
    return this.queue.length;
  }

  release(tx: object): void {
    if (this.holder !== tx) return;
    const next = this.queue.shift();
    this.holder = next?.tx ?? null;
    next?.grant();
  }
}

// What's committed: whether the restaurant is published, and which of its tables are active.
let committed: { isPublished: boolean; activeTables: Set<string> };
let restaurantLock: RowLock;
let tableLocks: Map<string, RowLock>;
// What each transaction has asked, in order, so a test can see who counted before whom.
let asked: string[];
// The test can stop the first transaction that reaches a step, and start another one meanwhile.
let stopAt: { step: string; reached: Deferred; go: Deferred } | null;

async function step(name: string): Promise<void> {
  asked.push(name);
  if (stopAt?.step !== name) return;
  const { reached, go } = stopAt;
  stopAt = null;
  reached.resolve();
  await go.promise;
}

function stop(stepName: string): { reached: Promise<void>; go: () => void } {
  const reached = deferred();
  const go = deferred();
  stopAt = { step: stepName, reached, go };
  return { reached: reached.promise, go: go.resolve };
}

/** Lets other transactions run until the condition holds. */
async function until(condition: () => boolean): Promise<void> {
  for (let turn = 0; turn < 50 && !condition(); turn++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  expect(condition()).toBe(true);
}

/** One transaction's client: its own locks, and its own changes until it commits. */
function transaction(): { client: unknown; commit: () => void; release: () => void } {
  const self = {};
  const held: RowLock[] = [];
  const switchedOff = new Set<string>();
  let published: boolean | undefined;
  const lock = async (rowLock: RowLock): Promise<void> => {
    await rowLock.acquire(self);
    held.push(rowLock);
  };
  const tableLock = (id: string): RowLock => {
    const existing = tableLocks.get(id) ?? new RowLock();
    tableLocks.set(id, existing);
    return existing;
  };

  const client = {
    $queryRaw: async (sql: TemplateStringsArray, ...values: unknown[]) => {
      const text = sql.join("?");
      if (text.includes('FROM "Table" t')) {
        const tableId = String(values[0]);
        await lock(tableLock(tableId));
        await step("table locked");
        // FOR UPDATE reads the row as last committed, once the lock is granted.
        return [
          {
            capacity: 4,
            minCapacity: 1,
            isActive: committed.activeTables.has(tableId),
            timezone: "Asia/Yerevan",
          },
        ];
      }
      await lock(restaurantLock);
      await step("restaurant locked");
      return text.includes('"isPublished"')
        ? [{ isPublished: committed.isPublished }]
        : [{ "?column?": 1 }];
    },
    table: {
      // Each statement sees what's committed, plus this transaction's own changes.
      count: async ({ where }: { where: { id?: { not: string } } }) => {
        await step("tables counted");
        return [...committed.activeTables].filter(
          (id) => !switchedOff.has(id) && id !== where.id?.not,
        ).length;
      },
      update: async ({ where, data }: { where: { id: string }; data: { isActive?: boolean } }) => {
        if (data.isActive === false) switchedOff.add(where.id);
        return tableRow({ id: where.id, ...data });
      },
    },
    openingHour: {
      count: async () => {
        await step("hours counted");
        return 7;
      },
    },
    reservation: {
      findMany: async () => {
        await step("bookings read");
        return [];
      },
    },
    restaurant: {
      update: async ({ data }: { data: { isPublished?: boolean } }) => {
        published = data.isPublished;
        return ownedRow({ isPublished: data.isPublished ?? committed.isPublished });
      },
    },
  };

  return {
    client,
    commit: () => {
      for (const id of switchedOff) committed.activeTables.delete(id);
      if (published !== undefined) committed.isPublished = published;
    },
    release: () => {
      for (const rowLock of held.toReversed()) rowLock.release(self);
    },
  };
}

beforeEach(() => {
  restaurantLock = new RowLock();
  tableLocks = new Map();
  asked = [];
  stopAt = null;
  // A transaction commits only if its work finishes; either way, its locks are released at the end.
  vi.mocked(prisma.$transaction).mockImplementation((async (
    work: (client: unknown) => Promise<unknown>,
  ) => {
    const tx = transaction();
    try {
      const result = await work(tx.client);
      tx.commit();
      return result;
    } finally {
      tx.release();
    }
  }) as never);
});

const switchOff = (tableId: string): ReturnType<typeof updateTable> =>
  updateTable(ani.id, RESTAURANT, tableId, { isActive: false }, NOW);
const publish = (): ReturnType<typeof updateRestaurant> =>
  updateRestaurant(ani.id, RESTAURANT, { isPublished: true });

describe("publishing and switching off the last active table at the same moment", () => {
  test("switching off first: publishing waits for it, then counts no table, and is refused", async () => {
    committed = { isPublished: false, activeTables: new Set([T1]) };
    // Holding T1 and the restaurant, about to read T1's bookings.
    const switching = stop("bookings read");

    const switchingOff = switchOff(T1);
    await switching.reached;
    const publishing = publish();
    await until(() => restaurantLock.waiting === 1);
    // Publishing waits for the restaurant's lock, and hasn't counted anything yet.
    expect(asked).not.toContain("tables counted");

    switching.go();

    await expect(switchingOff).resolves.toMatchObject({ isActive: false });
    await expect(publishing).rejects.toMatchObject({
      code: "NOT_READY_TO_PUBLISH",
      details: { missing: ["TABLE"] },
    });
    expect(committed).toEqual({ isPublished: false, activeTables: new Set() });
  });

  test("publishing first: switching off waits for it, then sees it published, and is refused", async () => {
    committed = { isPublished: false, activeTables: new Set([T1]) };
    // Holding the restaurant, having counted T1 as active.
    const publishingStep = stop("hours counted");

    const publishing = publish();
    await publishingStep.reached;
    const switchingOff = switchOff(T1);
    // It gets T1's lock at once, then waits for the restaurant's, without reading anything.
    await until(() => restaurantLock.waiting === 1);
    expect(asked).toEqual(["restaurant locked", "tables counted", "hours counted", "table locked"]);

    publishingStep.go();

    await expect(publishing).resolves.toMatchObject({ isPublished: true });
    await expect(switchingOff).rejects.toMatchObject({ code: "LAST_ACTIVE_TABLE" });
    expect(committed).toEqual({ isPublished: true, activeTables: new Set([T1]) });
  });

  test("with a second active table, both go through", async () => {
    committed = { isPublished: false, activeTables: new Set([T1, T2]) };
    const publishingStep = stop("hours counted");

    const publishing = publish();
    await publishingStep.reached;
    const switchingOff = switchOff(T1);
    await until(() => restaurantLock.waiting === 1);
    publishingStep.go();

    await expect(publishing).resolves.toMatchObject({ isPublished: true });
    await expect(switchingOff).resolves.toMatchObject({ isActive: false });
    expect(committed).toEqual({ isPublished: true, activeTables: new Set([T2]) });
  });
});

describe("switching off a published restaurant's last two tables at the same moment", () => {
  test("the second waits for the first, then counts again, and is refused", async () => {
    committed = { isPublished: true, activeTables: new Set([T1, T2]) };
    // The first holds T1 and the restaurant, about to read T1's bookings.
    const first = stop("bookings read");

    const switchingT1 = switchOff(T1);
    await first.reached;
    const switchingT2 = switchOff(T2);
    // The second gets T2's lock at once, then waits for the restaurant's.
    await until(() => restaurantLock.waiting === 1);
    first.go();

    await expect(switchingT1).resolves.toMatchObject({ isActive: false });
    await expect(switchingT2).rejects.toMatchObject({ code: "LAST_ACTIVE_TABLE" });
    expect(committed).toEqual({ isPublished: true, activeTables: new Set([T2]) });
  });
});
