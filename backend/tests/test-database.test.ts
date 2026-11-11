// The guards that keep npm run test:db on yerevan_test (tests/db/database-url.ts), and the line
// between the two test commands. These run in npm test, with no database and no backend/.env.
import { describe, expect, test } from "vitest";

import unitConfig from "../vitest.config.ts";
import { testDatabaseUrlFrom } from "./db/database-url.ts";

const DEVELOPMENT = "postgresql://yerevan:not-a-real-secret@localhost:5432/yerevan_dev";

describe("the test database's address", () => {
  test("is the development server and account, with yerevan_test as the database", () => {
    expect(testDatabaseUrlFrom(`${DEVELOPMENT}?schema=public`)).toBe(
      "postgresql://yerevan:not-a-real-secret@localhost:5432/yerevan_test?schema=public",
    );
    expect(testDatabaseUrlFrom("postgres://yerevan:pw@127.0.0.1:5432/yerevan_dev")).toBe(
      "postgres://yerevan:pw@127.0.0.1:5432/yerevan_test",
    );
  });

  test("refuses a server on another computer", () => {
    expect(() =>
      testDatabaseUrlFrom("postgresql://yerevan:pw@db.example.com:5432/yerevan_dev"),
    ).toThrow("only uses a PostgreSQL server on this computer");
  });

  test("refuses anything that isn't a PostgreSQL address", () => {
    for (const address of ["mysql://yerevan:pw@localhost:3306/yerevan_dev", "yerevan_dev", ""]) {
      expect(() => testDatabaseUrlFrom(address), address).toThrow();
    }
  });

  test("refuses a development address that already names yerevan_test, or no database", () => {
    for (const address of [
      "postgresql://yerevan:pw@localhost:5432/yerevan_test",
      "postgresql://yerevan:pw@localhost:5432/",
      "postgresql://yerevan:pw@localhost:5432",
    ]) {
      expect(() => testDatabaseUrlFrom(address), address).toThrow(
        "must name the development database",
      );
    }
  });

  test("never repeats the address in a refusal, because it holds the password", () => {
    for (const address of [
      "postgresql://yerevan:not-a-real-secret@db.example.com:5432/yerevan_dev",
      "postgresql://yerevan:not-a-real-secret@localhost:5432/yerevan_test",
      "mysql://yerevan:not-a-real-secret@localhost:3306/yerevan_dev",
    ]) {
      expect(() => testDatabaseUrlFrom(address)).toThrow(
        expect.objectContaining({ message: expect.not.stringContaining("not-a-real-secret") }),
      );
    }
  });
});

describe("npm test", () => {
  test("leaves tests/db to npm run test:db, so it never needs a database", () => {
    expect(unitConfig.test?.exclude).toContain("tests/db/**");
    expect(unitConfig.test?.env?.["DATABASE_URL"]).toContain("not_a_real_database");
  });
});
