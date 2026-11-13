import { describe, expect, test } from "vitest";

import {
  analyticsFigures,
  daysToParams,
  ratingBars,
  readDays,
  reviewsWords,
  shareWords,
  statusBars,
} from "@/features/analytics/analytics";
import { firstWeekAnalytics, loriAnalytics } from "@/features/design/samples";

describe("the period in the address", () => {
  test.each([
    ["days=7", 7],
    ["days=90", 90],
    ["days=30", 30],
    // Missing, empty, or not one offered: the usual 30 days, as the API counts without ?days=.
    ["", 30],
    ["days=", 30],
    ["days=14", 30],
    ["days=7.0", 30],
  ])("?%s reads as %i days", (query, days) => {
    expect(readDays(new URLSearchParams(query))).toBe(days);
  });

  test("the usual 30 days are left out of the address, and the others written in", () => {
    expect(daysToParams(30).toString()).toBe("");
    expect(daysToParams(7).toString()).toBe("days=7");
    expect(daysToParams(90).toString()).toBe("days=90");
  });
});

describe("shareWords", () => {
  test.each([
    [5, 42, "12%"],
    [21, 42, "50%"],
    [42, 42, "100%"],
    [0, 42, "0%"],
    // Of nothing, nothing.
    [0, 0, "0%"],
    // Rounding mustn't say none when there was one, or all when one was missing.
    [1, 200, "<1%"],
    [199, 200, ">99%"],
    // Anything else rounds as usual.
    [3, 200, "2%"],
    [197, 200, "99%"],
  ])("%i of %i is %s", (part, whole, words) => {
    expect(shareWords(part, whole)).toBe(words);
  });
});

test("reviews are counted in words", () => {
  expect(reviewsWords(1)).toBe("1 review");
  expect(reviewsWords(8)).toBe("8 reviews");
  expect(reviewsWords(1284)).toBe("1,284 reviews");
});

describe("analyticsFigures", () => {
  test("bookings, the guests who came, cancellations and no-shows as shares, then the rating", () => {
    expect(analyticsFigures(loriAnalytics[30])).toEqual([
      { label: "Bookings", value: "21" },
      { label: "Guests", value: "38", note: "who came" },
      { label: "Cancellations", value: "3", note: "14% of bookings" },
      { label: "No-shows", value: "1", note: "5% of bookings" },
      // 34 out of 8 reviews, to one decimal, as the restaurant pages show an average.
      { label: "Rating", value: "4.3", note: "out of 5, from 8 reviews" },
    ]);
  });

  test("with no reviews, the rating is a dash that screen readers hear as a word", () => {
    expect(analyticsFigures(firstWeekAnalytics)[4]).toEqual({
      label: "Rating",
      value: "–",
      spoken: "None",
      note: "No reviews yet",
    });
  });

  test("large numbers are grouped by thousands", () => {
    const busy = { ...loriAnalytics[90], bookings: 12840, guests: 31002 };

    expect(
      analyticsFigures(busy)
        .slice(0, 2)
        .map(({ value }) => value),
    ).toEqual(["12,840", "31,002"]);
  });
});

test("the status bars come in the order a booking moves, each a share of the bookings", () => {
  expect(statusBars(loriAnalytics[30])).toEqual([
    { key: "PENDING", label: "Pending", value: 1, note: "5%" },
    { key: "CONFIRMED", label: "Confirmed", value: 3, note: "14%" },
    { key: "ARRIVED", label: "Arrived", value: 13, note: "62%" },
    { key: "NO_SHOW", label: "No-show", value: 1, note: "5%" },
    { key: "CANCELLED", label: "Cancelled", value: 3, note: "14%" },
  ]);
});

test("the rating bars go from 5 down to 1, each a share of the reviews", () => {
  expect(ratingBars(loriAnalytics[30])).toEqual([
    { key: "5", label: "5 out of 5", value: 5, note: "63%" },
    { key: "4", label: "4 out of 5", value: 2, note: "25%" },
    { key: "3", label: "3 out of 5", value: 0, note: "0%" },
    { key: "2", label: "2 out of 5", value: 0, note: "0%" },
    { key: "1", label: "1 out of 5", value: 1, note: "13%" },
  ]);
});
