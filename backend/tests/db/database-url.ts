// Where the database tests run: yerevan_test, a separate database on the same local PostgreSQL
// server as yerevan_dev. npm run test:db takes DATABASE_URL from backend/.env, and nothing else
// from that file, and swaps the database's name. npm test never reads any of this.
import { readFileSync } from "node:fs";

import { parse } from "dotenv";

export const TEST_DATABASE = "yerevan_test";

// The tests empty their database, so they only ever use a server on this computer.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** The database a PostgreSQL address names, such as yerevan_dev. */
export function databaseName(address: string): string {
  return decodeURIComponent(new URL(address).pathname.slice(1));
}

/**
 * The test database's address, made from the development one: the same server and account, with
 * yerevan_test as the database. It refuses an address on another computer, one that isn't
 * PostgreSQL, and one that doesn't name a development database, so the two can never be the
 * same. Its errors never repeat the address, because it holds the password.
 */
export function testDatabaseUrlFrom(developmentUrl: string): string {
  let url: URL;
  try {
    url = new URL(developmentUrl);
  } catch {
    throw new Error("DATABASE_URL in backend/.env isn't a valid address.");
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("DATABASE_URL in backend/.env must be a PostgreSQL address.");
  }
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error("npm run test:db only uses a PostgreSQL server on this computer.");
  }
  const developmentName = databaseName(developmentUrl);
  if (!developmentName || developmentName === TEST_DATABASE) {
    throw new Error(
      "DATABASE_URL in backend/.env must name the development database, such as yerevan_dev.",
    );
  }
  url.pathname = `/${TEST_DATABASE}`;
  return url.toString();
}

/** DATABASE_URL from backend/.env. Only npm run test:db calls this. */
export function readDevelopmentUrl(): string {
  let values: Record<string, string>;
  try {
    values = parse(readFileSync(new URL("../../.env", import.meta.url)));
  } catch {
    throw new Error("npm run test:db needs backend/.env. Copy it from backend/.env.example.");
  }
  const url = values["DATABASE_URL"];
  if (!url) throw new Error("backend/.env has no DATABASE_URL.");
  return url;
}
