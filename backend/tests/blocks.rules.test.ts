// The rules for a block's time (src/modules/blocks/blocks.rules.ts), with no database.
import { describe, expect, test } from "vitest";

import {
  blockRange,
  blockRangeProblem,
  blockRefusalMessage,
  parseLocalDateTime,
} from "../src/modules/blocks/blocks.rules.ts";

const YEREVAN = "Asia/Yerevan";

describe("a local date and time", () => {
  test("is a date and the minutes after its midnight", () => {
    expect(parseLocalDateTime("2026-11-20T18:00")).toEqual({ date: "2026-11-20", minutes: 1080 });
    expect(parseLocalDateTime("2026-11-20T00:00")).toEqual({ date: "2026-11-20", minutes: 0 });
    expect(parseLocalDateTime("2026-11-20T23:45")).toEqual({ date: "2026-11-20", minutes: 1425 });
  });

  test("must be a real date and time on the quarter hour, written the one way", () => {
    for (const text of [
      "2026-11-20T18:07",
      "2026-11-20T24:00",
      "2026-02-30T10:00",
      "2026-11-20 18:00",
      "2026-11-20T18:00:00",
      "2026-11-20T18:00Z",
      "20/11/2026 18:00",
      "tomorrow",
    ]) {
      expect(parseLocalDateTime(text)).toBeNull();
    }
  });
});

describe("the moments a block covers, in the restaurant's own time", () => {
  test("a date is its whole calendar day, from one local midnight to the next", () => {
    // Yerevan is four hours ahead of UTC.
    expect(blockRange({ date: "2026-12-31" }, YEREVAN)).toEqual({
      startsAt: new Date("2026-12-30T20:00:00.000Z"),
      endsAt: new Date("2026-12-31T20:00:00.000Z"),
    });
  });

  test("a time range can cross midnight", () => {
    expect(blockRange({ from: "2026-11-20T18:00", to: "2026-11-21T02:00" }, YEREVAN)).toEqual({
      startsAt: new Date("2026-11-20T14:00:00.000Z"),
      endsAt: new Date("2026-11-20T22:00:00.000Z"),
    });
  });

  test("or last several days", () => {
    expect(blockRange({ from: "2027-01-01T00:00", to: "2027-01-08T00:00" }, YEREVAN)).toEqual({
      startsAt: new Date("2026-12-31T20:00:00.000Z"),
      endsAt: new Date("2027-01-07T20:00:00.000Z"),
    });
  });

  test("no offset is written down: a day when the clocks change has 25 hours", () => {
    // New York leaves summer time on 1 November 2026.
    const { startsAt, endsAt } = blockRange({ date: "2026-11-01" }, "America/New_York");

    expect(startsAt).toEqual(new Date("2026-11-01T04:00:00.000Z"));
    expect(endsAt.getTime() - startsAt.getTime()).toBe(25 * 60 * 60 * 1000);
  });
});

describe("what's wrong with a block's time", () => {
  // Tuesday 10 November 2026, 14:00 in Yerevan.
  const now = new Date("2026-11-10T10:00:00.000Z");
  const range = (startsAt: string, endsAt: string): { startsAt: Date; endsAt: Date } => ({
    startsAt: new Date(startsAt),
    endsAt: new Date(endsAt),
  });

  test("nothing, for a block later on", () => {
    expect(
      blockRangeProblem(range("2026-11-14T08:00:00Z", "2026-11-14T11:00:00Z"), now),
    ).toBeNull();
  });

  test("nothing, for one that started earlier and isn't over: the rest of today", () => {
    expect(
      blockRangeProblem(range("2026-11-09T20:00:00Z", "2026-11-10T20:00:00Z"), now),
    ).toBeNull();
  });

  test("an end that isn't after the start", () => {
    expect(blockRangeProblem(range("2026-11-14T11:00:00Z", "2026-11-14T11:00:00Z"), now)).toBe(
      "End the block after it starts.",
    );
  });

  test("a block that's already over", () => {
    expect(blockRangeProblem(range("2026-11-09T08:00:00Z", "2026-11-10T10:00:00Z"), now)).toBe(
      "Choose a time that hasn't passed yet.",
    );
  });

  test("a block longer than a year: 366 days is the most", () => {
    // 14 November 2026 to 15 November 2027 is 366 days, and one more day is too long.
    expect(
      blockRangeProblem(range("2026-11-14T00:00:00Z", "2027-11-15T00:00:00Z"), now),
    ).toBeNull();
    expect(blockRangeProblem(range("2026-11-14T00:00:00Z", "2027-11-16T00:00:00Z"), now)).toBe(
      "Block up to a year at a time.",
    );
  });
});

test("the owner is told how many bookings fall inside the block", () => {
  expect(blockRefusalMessage(1)).toBe(
    "An upcoming booking falls inside this block. Choose another time, or cancel that booking first.",
  );
  expect(blockRefusalMessage(3)).toBe(
    "3 upcoming bookings fall inside this block. Choose another time, or cancel them first.",
  );
});
