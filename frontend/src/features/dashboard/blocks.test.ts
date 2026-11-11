import { describe, expect, test } from "vitest";

import { blockFormSchema, blockWhat, blockWhen, newBlock } from "@/features/dashboard/blocks";
import type { BlockFields } from "@/features/dashboard/blocks";
import { sampleBlocks } from "@/features/design/samples";

const FRIDAY = "2026-11-13";
const blank = newBlock(FRIDAY);

/** The message for each field the form refuses. */
function problems(fields: BlockFields): Record<string, string> {
  return Object.fromEntries(
    (blockFormSchema.safeParse(fields).error?.issues ?? []).map((issue) => [
      String(issue.path[0]),
      issue.message,
    ]),
  );
}

describe("what the block form sends", () => {
  test("the whole restaurant, for a whole day: just the date", () => {
    expect(blockFormSchema.parse(blank)).toEqual({ date: FRIDAY });
  });

  test("one table, for a time range: the table, and both moments in the restaurant's time", () => {
    expect(
      blockFormSchema.parse({
        ...blank,
        scope: "table",
        tableId: "table-t4",
        kind: "range",
        fromDate: "2026-11-20",
        fromTime: "18:00",
        toDate: "2026-11-21",
        toTime: "02:00",
        reason: "  Private event ",
      }),
    ).toEqual({
      tableId: "table-t4",
      from: "2026-11-20T18:00",
      to: "2026-11-21T02:00",
      reason: "Private event",
    });
  });

  test("only what's chosen: a table left from before isn't sent for the whole restaurant", () => {
    expect(blockFormSchema.parse({ ...blank, tableId: "table-t4", reason: "   " })).toEqual({
      date: FRIDAY,
    });
  });
});

describe("what the block form refuses", () => {
  test("one table, without a table chosen", () => {
    expect(problems({ ...blank, scope: "table" })).toEqual({ tableId: "Choose a table." });
  });

  test("a range that ends before it starts, or as it starts", () => {
    const range: BlockFields = { ...blank, kind: "range", fromTime: "18:00", toTime: "18:00" };

    expect(problems(range)).toEqual({ toDate: "End the block after it starts." });
    expect(problems({ ...range, toDate: "2026-11-12", toTime: "23:00" })).toEqual({
      toDate: "End the block after it starts.",
    });
  });

  test("a date that isn't one", () => {
    expect(problems({ ...blank, date: "" })).toEqual({ date: "Choose a date." });
    expect(problems({ ...blank, kind: "range", fromDate: "2026-02-30" })).toEqual({
      fromDate: "Choose a date.",
    });
  });

  test("a reason over 200 characters", () => {
    expect(problems({ ...blank, reason: "x".repeat(201) })).toEqual({
      reason: "Use 200 characters or fewer.",
    });
  });
});

describe("a block in words", () => {
  const [evening, pastMidnight, newYearsEve, holidayWeek] = sampleBlocks;

  test("one table for an evening", () => {
    expect(evening && blockWhen(evening, FRIDAY)).toEqual({
      days: "Saturday 14 November",
      times: "18:00–23:00",
    });
    expect(evening && blockWhat(evening)).toBe("Table T4 · Terrace");
  });

  test("the whole restaurant past midnight shows both days", () => {
    expect(pastMidnight && blockWhen(pastMidnight, FRIDAY)).toEqual({
      days: "Friday 20 November – Saturday 21 November",
      times: "18:00–02:00",
    });
    expect(pastMidnight && blockWhat(pastMidnight)).toBe("Whole restaurant");
  });

  test("a whole day is all day, and a day in another year says its year", () => {
    expect(newYearsEve && blockWhen(newYearsEve, FRIDAY)).toEqual({
      days: "Thursday 31 December",
      times: "All day",
    });
    expect(holidayWeek && blockWhen(holidayWeek, FRIDAY)).toEqual({
      days: "Friday 1 January 2027 – Thursday 7 January 2027",
      times: "All day",
    });
  });

  test("an evening that ends at midnight is that evening alone", () => {
    expect(
      blockWhen(
        { starts: { date: FRIDAY, time: "18:00" }, ends: { date: "2026-11-14", time: "00:00" } },
        FRIDAY,
      ),
    ).toEqual({ days: "Friday 13 November", times: "18:00–00:00" });
  });
});
