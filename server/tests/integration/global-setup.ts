// Runs once before the integration tests and once after them, in a separate process from the tests.
import { execFileSync } from "node:child_process";

import pg from "pg";

import {
  assertConnectedToTestDatabase,
  emptyTestDatabase,
  requireTestDatabaseUrl,
  TEST_DATABASE,
} from "./test-database.ts";

async function connect(url: string): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5_000 });
  try {
    await client.connect();
  } catch (error) {
    // The message never includes the URL, because that holds the password.
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Can't reach ${TEST_DATABASE}: ${reason}\n` +
        "Start Postgres with `docker compose up -d`, or run the tests that need no database with " +
        "`npm test -w server -- --project unit`.",
    );
  }
  return client;
}

export default async function setup(): Promise<() => Promise<void>> {
  const url = requireTestDatabaseUrl();
  const client = await connect(url);

  try {
    await assertConnectedToTestDatabase(client);

    // `migrate deploy` only applies missing migrations. It never resets or deletes anything.
    execFileSync("npx", ["prisma", "migrate", "deploy"], {
      env: { ...process.env, DATABASE_URL: url },
      stdio: "pipe",
    });

    // A default that isn't UTC gives the UTC pin in prisma.ts something to prove. New connections
    // pick these up, and both settings apply to this test database only.
    await client.query(`ALTER DATABASE "${TEST_DATABASE}" SET timezone TO 'Asia/Yerevan'`);
    // Races deadlock often, and Postgres normally waits a full second before sorting each one out.
    await client.query(`ALTER DATABASE "${TEST_DATABASE}" SET deadlock_timeout TO '50ms'`);

    // Clears anything left behind by a run that crashed.
    await emptyTestDatabase(client);
  } finally {
    await client.end();
  }

  return async () => {
    const cleanup = await connect(url);
    try {
      await assertConnectedToTestDatabase(cleanup);
      await emptyTestDatabase(cleanup);
    } finally {
      await cleanup.end();
    }
  };
}
