import { describe, expect, test } from "vitest";

import {
  bookingLink,
  HOME_COUNT,
  HOME_CUISINES,
  homeRestaurants,
  restaurantsWords,
  TONIGHT_TIMES,
  tonightTimes,
} from "@/features/home/home";
import { CUISINE_LABELS } from "@/features/restaurants/labels";
import type { Availability, AvailabilitySlot } from "@/types/api";

const slot = (starts: string, free = true): AvailabilitySlot => ({
  startsAt: "2026-11-13T15:00:00.000Z",
  endsAt: "2026-11-13T17:00:00.000Z",
  starts,
  ends: starts,
  tables: free ? [{ id: "table-t1", label: "T1", zone: "INDOOR", capacity: 2 }] : [],
});

const day = (slots: AvailabilitySlot[]): Availability => ({
  date: "2026-11-13",
  partySize: 2,
  bookingWindow: { first: "2026-11-13", last: "2027-01-12" },
  slots,
});

test("tonight's times are the first free ones from 18:00, three at most", () => {
  const times = tonightTimes(
    day([
      slot("12:00"),
      slot("17:30"),
      slot("18:00", false),
      slot("18:30"),
      slot("19:00"),
      slot("19:30"),
      slot("20:00"),
    ]),
  );

  expect(times).toEqual(["18:30", "19:00", "19:30"]);
  expect(times).toHaveLength(TONIGHT_TIMES);
});

test("with every evening table taken, or only lunch left, there are none tonight", () => {
  expect(tonightTimes(day([slot("12:00"), slot("18:00", false), slot("21:00", false)]))).toEqual(
    [],
  );
  expect(tonightTimes(day([]))).toEqual([]);
});

test("a time links to the restaurant's page with the booking at it, for two", () => {
  const link = bookingLink("dolmama", "2026-11-13", "19:00");

  expect(link).toEqual({
    pathname: "/restaurants/dolmama",
    search: "?date=2026-11-13&guests=2&time=19%3A00",
  });
});

test("the cuisines offered are real ones, each once", () => {
  for (const cuisine of HOME_CUISINES) expect(CUISINE_LABELS[cuisine]).toBeTruthy();
  expect(new Set(HOME_CUISINES).size).toBe(HOME_CUISINES.length);
});

test("counts read naturally", () => {
  expect(restaurantsWords(1)).toBe("1 restaurant");
  expect(restaurantsWords(13)).toBe("13 restaurants");
  expect(restaurantsWords(0)).toBe("0 restaurants");
});

describe("the home page's restaurants", () => {
  const listed = (...slugs: string[]): { slug: string }[] => slugs.map((slug) => ({ slug }));
  const slugsOf = (restaurants: { slug: string }[]): string[] =>
    restaurants.map(({ slug }) => slug);

  test("are the featured ones first, in their order, then others that aren't among them", () => {
    const shown = homeRestaurants(listed("nurr", "lori"), listed("kond", "lori", "sevan"));

    expect(slugsOf(shown)).toEqual(["nurr", "lori", "kond", "sevan"]);
  });

  test("are eight at most: two rows of four", () => {
    const others = listed("a", "b", "c", "d", "e", "f", "g", "h", "i", "j");

    expect(HOME_COUNT).toBe(8);
    expect(slugsOf(homeRestaurants(listed("nurr"), others))).toEqual([
      "nurr",
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
      "g",
    ]);
  });

  test("with more featured than fit, are the first eight featured", () => {
    const featured = listed("a", "b", "c", "d", "e", "f", "g", "h", "i");

    expect(slugsOf(homeRestaurants(featured, listed("nurr")))).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
      "g",
      "h",
    ]);
  });

  test("with none featured, are the first others", () => {
    expect(slugsOf(homeRestaurants([], listed("kond", "lori")))).toEqual(["kond", "lori"]);
    expect(homeRestaurants([], [])).toEqual([]);
  });

  test("are the very restaurants given, with all they hold", () => {
    const nurr = { slug: "nurr", name: "Nurr" };

    expect(homeRestaurants([nurr], [])[0]).toBe(nurr);
  });
});
