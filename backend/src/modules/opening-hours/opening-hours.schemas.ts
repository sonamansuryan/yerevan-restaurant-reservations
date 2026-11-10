import { z } from "zod";

import { MINUTES_PER_DAY } from "../../lib/time.ts";
import {
  OPENINGS_PER_DAY,
  describeOpening,
  extraOpenings,
  findOverlaps,
} from "./opening-hours.rules.ts";

const DAY = "Choose a day of the week.";
const OPENS = "Choose an opening time from 00:00 to 23:45, on the quarter hour.";
const CLOSES = "Choose a closing time on the quarter hour.";
const TOO_MANY = `Use up to ${OPENINGS_PER_DAY} opening times a day.`;

// Start times are offered every 15 or 30 minutes from opening (PROJECT_PLAN.md §5.2), so times
// sit on the quarter hour. Opening at 18:07 would offer 18:07, 18:37 and so on.
const QUARTER_HOUR = 15;

/**
 * One opening. Minutes after the day's midnight, and a closing after midnight counts on from the
 * same day: Friday 18:00 to 02:00 is 1080 to 1560. The database refuses the same mistakes
 * (OpeningHour_day and OpeningHour_range), so these rules only add messages and quarter hours.
 */
const openingSchema = z
  .object({
    dayOfWeek: z.number({ error: DAY }).int(DAY).min(0, DAY).max(6, DAY),
    opensAt: z
      .number({ error: OPENS })
      .int(OPENS)
      .min(0, OPENS)
      .max(MINUTES_PER_DAY - QUARTER_HOUR, OPENS)
      .multipleOf(QUARTER_HOUR, OPENS),
    closesAt: z.number({ error: CLOSES }).int(CLOSES).multipleOf(QUARTER_HOUR, CLOSES),
  })
  .superRefine(({ opensAt, closesAt }, ctx) => {
    if (closesAt <= opensAt) {
      ctx.addIssue({ code: "custom", path: ["closesAt"], message: "Close after opening." });
    } else if (closesAt - opensAt > MINUTES_PER_DAY) {
      ctx.addIssue({
        code: "custom",
        path: ["closesAt"],
        message: "Close within 24 hours of opening.",
      });
    }
  });

/**
 * PUT /api/owner/restaurants/:restaurantId/opening-hours: the whole week, which replaces the old
 * one. A day that isn't listed is closed. An empty week isn't accepted: a published restaurant
 * must keep its hours, and closing for a while is what unpublishing is for.
 */
export const weekSchema = z.object({
  hours: z
    .array(openingSchema, { error: "Send the week's opening times as a list." })
    .min(1, "Add at least one opening time.")
    .max(OPENINGS_PER_DAY * 7, TOO_MANY)
    // The week as a whole. Each problem is put on the opening it's about, so a form can show it
    // there: "hours.3" for the fourth opening in the list.
    .superRefine((hours, ctx) => {
      for (const index of extraOpenings(hours)) {
        ctx.addIssue({ code: "custom", path: [index], message: TOO_MANY });
      }
      for (const { index, other } of findOverlaps(hours)) {
        const earlier = hours[other];
        if (!earlier) continue;
        ctx.addIssue({
          code: "custom",
          path: [index],
          message: `Overlaps ${describeOpening(earlier)}.`,
        });
      }
    }),
});

export type WeekInput = z.infer<typeof weekSchema>;
