// An in-memory stand-in for src/lib/prisma.ts, so tests need no database. Use it with:
//   vi.mock("../src/lib/prisma.ts", () => import("./fake-prisma.ts"));
//
// It covers only what the auth code uses: the User and RefreshToken tables, transactions and the
// per-person lock. It copies the Postgres behaviour that code depends on: other requests can't see
// a transaction's writes until it commits, a failed transaction leaves nothing behind, and a lock
// makes the next request wait. Anything else throws, so a test can't pass by accident.
//
// It proves our logic, not the database. Constraints, real locks and SQL are never run here.
import { randomUUID } from "node:crypto";

import { Prisma } from "../src/generated/prisma/client.ts";

type Row = Record<string, unknown>;

interface Table {
  rows: Row[];
  unique: string[];
  defaults: () => Row;
}

interface Transaction {
  created: { table: Table; row: Row }[];
  changed: Map<Row, Row>;
  deleted: Map<Row, Table>;
  locks: Map<string, () => void>;
}

/** A row as one transaction sees it: `row` is the stored object, `value` includes its own edits. */
interface Seen {
  row: Row;
  value: Row;
}

interface Args {
  where?: Row;
  data?: Row;
  select?: Row;
  orderBy?: unknown;
}

type Run = <T>(work: (tx: Transaction) => T) => Promise<T>;

const users: Table = {
  rows: [],
  unique: ["id", "email", "googleId"],
  defaults: () => ({
    id: randomUUID(),
    phone: null,
    passwordHash: null,
    googleId: null,
    role: "CUSTOMER",
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
};

const refreshTokens: Table = {
  rows: [],
  unique: ["id", "tokenHash"],
  defaults: () => ({ id: randomUUID(), revokedAt: null, createdAt: new Date() }),
};

const locks = new Map<string, Promise<void>>();
let waiting = 0;

/** How many requests are stuck behind a lock right now. */
export function waitingForLock(): number {
  return waiting;
}

function newTransaction(): Transaction {
  return { created: [], changed: new Map(), deleted: new Map(), locks: new Map() };
}

function commit(tx: Transaction): void {
  for (const [row, value] of tx.changed) Object.assign(row, value);
  for (const [row, table] of tx.deleted) table.rows.splice(table.rows.indexOf(row), 1);
  for (const { table, row } of tx.created) table.rows.push(row);
}

function seenBy(tx: Transaction, table: Table): Seen[] {
  const committed = table.rows
    .filter((row) => !tx.deleted.has(row))
    .map((row) => ({ row, value: tx.changed.get(row) ?? row }));
  const own = tx.created.filter((entry) => entry.table === table);
  return [...committed, ...own.map(({ row }) => ({ row, value: row }))];
}

function matches(value: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (typeof expected === "object" && expected !== null) {
      throw new Error(`The fake database only compares plain values, not ${key}.`);
    }
    return expected === undefined || value[key] === expected;
  });
}

function change(tx: Transaction, table: Table, { row, value }: Seen, data: Row): void {
  if (tx.created.some((entry) => entry.table === table && entry.row === row)) {
    Object.assign(row, data);
  } else {
    tx.changed.set(row, { ...value, ...data });
  }
}

function remove(tx: Transaction, table: Table, { row }: Seen): void {
  const own = tx.created.findIndex((entry) => entry.row === row);
  if (own >= 0) tx.created.splice(own, 1);
  else tx.deleted.set(row, table);
}

/** Returns a copy, as a real query would, so a test's saved rows can't change later. */
function shape(tx: Transaction, value: Row, select?: Row): Row {
  if (!select) return structuredClone(value);

  const result: Row = {};
  for (const [key, wanted] of Object.entries(select)) {
    if (key === "user") {
      const owner = seenBy(tx, users).find((user) => user.value["id"] === value["userId"]);
      result[key] = owner ? shape(tx, owner.value, (wanted as { select: Row }).select) : null;
    } else {
      result[key] = value[key];
    }
  }
  return structuredClone(result);
}

function knownError(code: string, message: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(message, { code, clientVersion: "fake" });
}

function model(table: Table, run: Run) {
  const find = (tx: Transaction, where?: Row): Seen[] =>
    seenBy(tx, table).filter(({ value }) => matches(value, where));

  const only = (tx: Transaction, where?: Row): Seen => {
    const [found] = find(tx, where);
    if (!found) throw knownError("P2025", "No record was found.");
    return found;
  };

  const removeRows = (tx: Transaction, found: Seen[]): void => {
    for (const entry of found) {
      remove(tx, table, entry);
      // The schema's onDelete: Cascade.
      if (table === users) {
        const tokens = seenBy(tx, refreshTokens);
        for (const token of tokens) {
          if (token.value["userId"] === entry.value["id"]) remove(tx, refreshTokens, token);
        }
      }
    }
  };

  return {
    create: ({ data, select }: Args) =>
      run((tx) => {
        const given = Object.entries(data ?? {}).filter(([, value]) => value !== undefined);
        const row = { ...table.defaults(), ...Object.fromEntries(given) };
        const taken = table.unique.some(
          (key) =>
            row[key] !== null && seenBy(tx, table).some(({ value }) => value[key] === row[key]),
        );
        if (taken) throw knownError("P2002", "Unique constraint failed.");
        tx.created.push({ table, row });
        return shape(tx, row, select);
      }),

    findUnique: ({ where, select }: Args) =>
      run((tx) => {
        const [found] = find(tx, where);
        return found ? shape(tx, found.value, select) : null;
      }),

    findUniqueOrThrow: ({ where, select }: Args) =>
      run((tx) => shape(tx, only(tx, where).value, select)),

    findMany: ({ where, orderBy }: Args) =>
      run((tx) => {
        const found = find(tx, where).map(({ value }) => shape(tx, value));
        if (orderBy) found.sort((a, b) => String(a["id"]).localeCompare(String(b["id"])));
        return found;
      }),

    count: ({ where }: Args) => run((tx) => find(tx, where).length),

    update: ({ where, data }: Args) =>
      run((tx) => {
        const found = only(tx, where);
        change(tx, table, found, data ?? {});
        return shape(tx, { ...found.value, ...data });
      }),

    updateMany: ({ where, data }: Args) =>
      run((tx) => {
        const found = find(tx, where);
        for (const entry of found) change(tx, table, entry, data ?? {});
        return { count: found.length };
      }),

    delete: ({ where }: Args) =>
      run((tx) => {
        const found = only(tx, where);
        removeRows(tx, [found]);
        return shape(tx, found.value);
      }),

    deleteMany: ({ where }: Args) =>
      run((tx) => {
        const found = find(tx, where);
        removeRows(tx, found);
        return { count: found.length };
      }),
  };
}

/** Waits for the lock's current holder, and holds it until this transaction ends. */
async function takeLock(tx: Transaction, key: string): Promise<void> {
  if (tx.locks.has(key)) return;

  let release = (): void => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const previous = locks.get(key) ?? Promise.resolve();
  locks.set(
    key,
    previous.then(() => held),
  );

  waiting += 1;
  await previous;
  waiting -= 1;
  tx.locks.set(key, release);
}

function clientFor(tx: Transaction | null) {
  // Every call gives way first, so parallel requests interleave as they would on a real database.
  // A write outside a transaction commits straight away, like a single SQL statement.
  const run: Run = async (work) => {
    await new Promise((resolve) => setImmediate(resolve));
    const current = tx ?? newTransaction();
    const result = work(current);
    if (!tx) commit(current);
    return result;
  };

  return {
    user: model(users, run),
    refreshToken: model(refreshTokens, run),

    /** Only the person lock, `SELECT … FOR UPDATE`, inside a transaction. */
    async $queryRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]> {
      if (!tx || !query.join("").includes("FOR UPDATE")) {
        throw new Error("The fake database only understands the person lock.");
      }
      await takeLock(tx, String(values[0]));
      return [];
    },
  };
}

export const prisma = {
  ...clientFor(null),

  async $transaction<T>(work: (tx: ReturnType<typeof clientFor>) => Promise<T>): Promise<T> {
    const tx = newTransaction();
    try {
      const result = await work(clientFor(tx));
      commit(tx);
      return result;
    } finally {
      // If `work` failed, nothing was committed, so its writes simply disappear.
      for (const release of tx.locks.values()) release();
    }
  },
};

export function isDatabaseReachable(): Promise<boolean> {
  return Promise.resolve(true);
}
