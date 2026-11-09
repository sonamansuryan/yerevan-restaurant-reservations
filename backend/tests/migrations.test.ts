// Reads the migration files, because no test runs them against a database. This shows that the
// double-booking constraint is written down correctly, not that Postgres enforces it.
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import { ACTIVE_STATUSES } from "../src/modules/reservations/reservations.service.ts";

const folder = resolve(import.meta.dirname, "../prisma/migrations");

const migrations = readdirSync(folder, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => ({
    name: entry.name,
    sql: readFileSync(resolve(folder, entry.name, "migration.sql"), "utf8"),
  }));

const definition = /ADD CONSTRAINT "Reservation_no_overlap"[\s\S]*?\);/.exec(
  migrations.map(({ sql }) => sql).join("\n"),
)?.[0];

describe("Reservation_no_overlap", () => {
  test("is created by a migration", () => {
    expect(definition).toBeDefined();
  });

  test("covers exactly the statuses in ACTIVE_STATUSES", () => {
    const list = /"status" IN \(([^)]*)\)/.exec(definition ?? "")?.[1] ?? "";
    const statuses = [...list.matchAll(/'(\w+)'/g)].map(([, status]) => status);

    expect(statuses.sort()).toEqual([...ACTIVE_STATUSES].sort());
  });

  test("uses a half-open range, so back-to-back bookings can't clash", () => {
    expect(definition).toContain(`'[)'`);
  });

  test.each(migrations)("isn't dropped by $name", ({ sql }) => {
    expect(sql).not.toMatch(/DROP CONSTRAINT[^;]*Reservation_no_overlap/);
  });
});
