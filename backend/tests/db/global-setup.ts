// Runs once before npm run test:db. It makes sure yerevan_test exists with every migration
// applied, then asks the database itself whether it's the right one. It never changes yerevan_dev:
// outside yerevan_test, the only thing it ever asks the server to do is CREATE DATABASE.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import pg from "pg";

import {
  TEST_DATABASE,
  databaseName,
  readDevelopmentUrl,
  testDatabaseUrlFrom,
} from "./database-url.ts";

const BACKEND = fileURLToPath(new URL("../..", import.meta.url));

export default async function setup(): Promise<void> {
  const developmentUrl = readDevelopmentUrl();
  const testUrl = testDatabaseUrlFrom(developmentUrl);

  const created = await createTestDatabase(testUrl, databaseName(developmentUrl));
  applyMigrations(testUrl);
  await checkTestDatabase(testUrl);
  console.log(
    `Database tests use ${TEST_DATABASE}${created ? ", created just now," : ""} with every migration applied.`,
  );
}

/** Creates yerevan_test if the server doesn't have it yet, and says whether it did. */
async function createTestDatabase(testUrl: string, developmentName: string): Promise<boolean> {
  // CREATE DATABASE runs from the server's own "postgres" database, never from yerevan_dev.
  const serverUrl = new URL(testUrl);
  serverUrl.pathname = "/postgres";
  const server = new pg.Client({ connectionString: serverUrl.toString() });
  await server.connect();
  try {
    const { rows } = await server.query<{ datname: string }>(
      "SELECT datname FROM pg_database WHERE datname = ANY($1::text[])",
      [[developmentName, TEST_DATABASE]],
    );
    const names = rows.map(({ datname }) => datname);
    // The development database lives on this server too, so it's this project's own server, not
    // another one answering on the same port.
    if (!names.includes(developmentName)) {
      throw new Error(
        `This PostgreSQL server has no ${developmentName}, so it isn't this project's. Start the project's database with Docker Compose.`,
      );
    }
    if (names.includes(TEST_DATABASE)) return false;
    // A database's name can't be a query parameter, so it's written in. It's a constant.
    await server.query(`CREATE DATABASE ${TEST_DATABASE}`);
    return true;
  } finally {
    await server.end();
  }
}

/** Applies the migrations yerevan_test doesn't have yet. deploy never resets or deletes anything. */
function applyMigrations(testUrl: string): void {
  try {
    execFileSync("npx", ["prisma", "migrate", "deploy"], {
      cwd: BACKEND,
      // The Prisma CLI also loads backend/.env, but never replaces a value that's already set.
      env: { ...process.env, DATABASE_URL: testUrl },
      stdio: "pipe",
    });
  } catch (error) {
    const { stdout, stderr } = error as { stdout?: Buffer; stderr?: Buffer };
    const output = `${stdout?.toString() ?? ""}${stderr?.toString() ?? ""}`;
    // The address holds the password, so it never reaches the screen.
    const password = decodeURIComponent(new URL(testUrl).password);
    const safe = password ? output.replaceAll(password, "***") : output;
    throw new Error(`Couldn't apply the migrations to ${TEST_DATABASE}:\n${safe}`);
  }
}

/** Asks the database itself: is this yerevan_test, and does it have the double-booking guard? */
async function checkTestDatabase(testUrl: string): Promise<void> {
  const client = new pg.Client({ connectionString: testUrl });
  await client.connect();
  try {
    const { rows } = await client.query<{ name: string; guarded: boolean }>(
      `SELECT current_database() AS name,
              EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Reservation_no_overlap') AS guarded`,
    );
    const [here] = rows;
    if (here?.name !== TEST_DATABASE) {
      throw new Error(`The tests reached ${here?.name ?? "no database"}, not ${TEST_DATABASE}.`);
    }
    if (!here.guarded) {
      throw new Error(`${TEST_DATABASE} has no "Reservation_no_overlap". Check the migrations.`);
    }
  } finally {
    await client.end();
  }
}
