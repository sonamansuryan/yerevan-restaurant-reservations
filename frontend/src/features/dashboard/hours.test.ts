import { describe, expect, test } from "vitest";

import {
  QUARTER_HOURS,
  clockTime,
  closesNextDay,
  newOpening,
  openingFields,
  openingFromFields,
  openingMessages,
  weekFields,
  weekFormSchema,
  weekMessage,
} from "@/features/dashboard/hours";
import { ApiError } from "@/lib/api";
import type { OpeningHours } from "@/types/api";

const saved = (dayOfWeek: number, opensAt: number, closesAt: number): OpeningHours => ({
  dayOfWeek,
  opensAt,
  closesAt,
  opens: clockTime(opensAt),
  closes: clockTime(closesAt),
});

describe("times", () => {
  test("a day has 96 quarter hours, from 00:00 to 23:45", () => {
    expect(QUARTER_HOURS).toHaveLength(96);
    expect(QUARTER_HOURS[0]).toBe(0);
    expect(QUARTER_HOURS.at(-1)).toBe(1425);
  });

  test("minutes read as a clock, and past midnight the clock starts again", () => {
    expect(clockTime(0)).toBe("00:00");
    expect(clockTime(1080)).toBe("18:00");
    expect(clockTime(1440)).toBe("00:00");
    expect(clockTime(1560)).toBe("02:00");
  });

  test("a closing at or before the opening is the next day's", () => {
    expect(closesNextDay(1080, 1380)).toBe(false);
    expect(closesNextDay(1080, 120)).toBe(true);
    // The same time means open around the clock, until the same time tomorrow.
    expect(closesNextDay(600, 600)).toBe(true);
  });
});

describe("an opening between the form and the API", () => {
  test("a closing after midnight shows as a clock time, and is sent counted from the day", () => {
    expect(openingFields(saved(5, 1080, 1560))).toEqual({
      dayOfWeek: 5,
      opens: "1080",
      closes: "120",
    });
    expect(openingFromFields({ dayOfWeek: 5, opens: "1080", closes: "120" })).toEqual({
      dayOfWeek: 5,
      opensAt: 1080,
      closesAt: 1560,
    });
  });

  test("every saved opening comes back exactly as it was, midnight and 24 hours included", () => {
    const week = [
      saved(1, 720, 900),
      saved(5, 1080, 1440),
      saved(6, 1080, 1560),
      saved(0, 600, 2040),
      saved(3, 1425, 2865),
    ];

    for (const opening of week) {
      const { dayOfWeek, opensAt, closesAt } = opening;
      expect(openingFromFields(openingFields(opening))).toEqual({ dayOfWeek, opensAt, closesAt });
    }
  });

  test("a new opening is lunch to late evening, or an evening beside one already there", () => {
    expect(openingFromFields(newOpening(2, true))).toEqual({
      dayOfWeek: 2,
      opensAt: 720,
      closesAt: 1320,
    });
    expect(openingFromFields(newOpening(2, false))).toEqual({
      dayOfWeek: 2,
      opensAt: 1080,
      closesAt: 1380,
    });
  });
});

describe("the week", () => {
  test("it's sent in the form's own order, so the server's messages find their openings", () => {
    const fields = weekFields([saved(5, 1080, 1560), saved(1, 720, 900)]);

    expect(weekFormSchema.parse(fields)).toEqual({
      hours: [
        { dayOfWeek: 5, opensAt: 1080, closesAt: 1560 },
        { dayOfWeek: 1, opensAt: 720, closesAt: 900 },
      ],
    });
  });

  test("an empty week is refused in the server's words", () => {
    const result = weekFormSchema.safeParse({ hours: [] });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Add at least one opening time.");
  });
});

describe("the server's messages", () => {
  const refused = new ApiError(400, "VALIDATION_ERROR", "The request is invalid.", {
    fields: {
      "hours.3": "Overlaps Monday 12:00–15:00.",
      "hours.5.closesAt": "Close within 24 hours of opening.",
      "hours.5": "Overlaps Tuesday 18:00–23:00.",
      hours: "Add at least one opening time.",
      name: "Not about the week.",
    },
  });

  test("each opening gets its message, by its place in the list sent", () => {
    expect(openingMessages(refused)).toEqual(
      new Map([
        [3, "Overlaps Monday 12:00–15:00."],
        [5, "Close within 24 hours of opening."],
      ]),
    );
  });

  test("a message about the whole week is kept apart", () => {
    expect(weekMessage(refused)).toBe("Add at least one opening time.");
  });

  test("any other error has no messages for openings", () => {
    const offline = new ApiError(0, "NETWORK_ERROR", "We can't reach the server right now.");

    expect(openingMessages(offline).size).toBe(0);
    expect(weekMessage(offline)).toBeUndefined();
    expect(openingMessages(null).size).toBe(0);
  });
});
