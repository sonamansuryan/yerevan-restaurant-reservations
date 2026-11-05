// The guards that keep integration tests on yerevan_test. These tests write to the database and
// empty it, so every check here must pass before anything else happens.
import fs from "node:fs";

import { parse } from "dotenv";
import type pg from "pg";

export const TEST_DATABASE = "yerevan_test";

/**
 * The test database's URL. CI sets it in the environment, and on your machine it's in server/.env.
 * `parse` reads the file without loading it into process.env, because loading it would also bring
 * in DATABASE_URL, which points at yerevan_dev.
 */
export function readTestDatabaseUrl(): string | undefined {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  if (!fs.existsSync(".env")) return undefined;
  return parse(fs.readFileSync(".env")).TEST_DATABASE_URL;
}

/** The URL to use, or an error if it's missing or names any database but the test one. */
export function requireTestDatabaseUrl(): string {
  const url = readTestDatabaseUrl();
  if (!url) {
    throw new Error("TEST_DATABASE_URL is missing. Add it to server/.env, as in .env.example.");
  }

  const name = new URL(url).pathname.slice(1);
  if (name !== TEST_DATABASE) {
    throw new Error(`Refusing to run tests against "${name}". Use ${TEST_DATABASE}.`);
  }
  return url;
}

/** Asks the real connection which database it reached, instead of trusting the URL. */
export async function assertConnectedToTestDatabase(client: pg.Client): Promise<void> {
  const { rows } = await client.query<{ name: string }>("SELECT current_database() AS name");
  const name = rows[0]?.name;
  if (name !== TEST_DATABASE) {
    throw new Error(`Refusing to run tests against "${name}". Use ${TEST_DATABASE}.`);
  }
}

/**
 * Removes every row. The name check is inside the same statement as the TRUNCATE, so this can't
 * run against another database, whatever happened before it.
 */
export async function emptyTestDatabase(client: pg.Client): Promise<void> {
  await client.query(`
    DO $$
    BEGIN
      IF current_database() <> '${TEST_DATABASE}' THEN
        RAISE EXCEPTION 'Refusing to empty %', current_database();
      END IF;
      TRUNCATE "Review", "Reservation", "BlockedPeriod", "OpeningHour", "Table",
               "RestaurantPhoto", "Restaurant", "RefreshToken", "User";
    END $$;
  `);
}
