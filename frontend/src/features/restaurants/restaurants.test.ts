import { describe, expect, test } from "vitest";

import { filtersToParams, isFiltered, readFilters } from "@/features/restaurants/browseFilters";
import { cuisineLine, priceSigns, priceWords } from "@/features/restaurants/labels";
import { toneAt, toneFor } from "@/features/restaurants/tones";

const read = (query: string): ReturnType<typeof readFilters> =>
  readFilters(new URLSearchParams(query));

describe("readFilters", () => {
  test("reads every filter from the address", () => {
    expect(read("?q=wine&cuisine=GEORGIAN&district=KENTRON&price=2&page=3")).toEqual({
      q: "wine",
      cuisine: "GEORGIAN",
      district: "KENTRON",
      price: 2,
      page: 3,
    });
  });

  test("an empty address is page 1 of everything", () => {
    expect(read("")).toEqual({ page: 1 });
  });

  test("a search is trimmed, and spaces alone are no search", () => {
    expect(read("?q=%20%20wine%20").q).toBe("wine");
    expect(read("?q=%20%20")).toEqual({ page: 1 });
  });

  test.each([
    ["an unknown cuisine", "?cuisine=PIZZA"],
    ["a cuisine in lowercase", "?cuisine=georgian"],
    ["a name from the object's prototype", "?cuisine=toString"],
    ["an unknown district", "?district=CASCADE"],
    ["a price above ֏֏֏֏", "?price=5"],
    ["a price of 0", "?price=0"],
    ["a price that isn't a number", "?price=cheap"],
    ["half a price", "?price=1.5"],
  ])("%s is ignored, as the server would refuse it", (_case, query) => {
    expect(read(query)).toEqual({ page: 1 });
  });

  test.each(["?page=0", "?page=-2", "?page=two", "?page=1001"])("%s means page 1", (query) => {
    expect(read(query).page).toBe(1);
  });

  test("a search far too long is cut to the server's 100 characters", () => {
    expect(read(`?q=${"a".repeat(150)}`).q).toHaveLength(100);
  });
});

describe("the order", () => {
  test("only Highest rated is kept in the address: by name is the default", () => {
    expect(read("?sort=rating")).toEqual({ sort: "rating", page: 1 });
    expect(read("?sort=name")).toEqual({ page: 1 });
    expect(read("?sort=RATING")).toEqual({ page: 1 });
    expect(filtersToParams({ sort: "rating", page: 2 }).toString()).toBe("sort=rating&page=2");
    expect(filtersToParams({ sort: "name", page: 1 }).toString()).toBe("");
  });

  test("it isn't a filter, so it leaves Clear filters with nothing to clear", () => {
    expect(isFiltered({ sort: "rating", page: 1 })).toBe(false);
  });
});

describe("filtersToParams", () => {
  test("writes only what's chosen, and leaves out page 1", () => {
    expect(filtersToParams({ cuisine: "SEAFOOD", page: 1 }).toString()).toBe("cuisine=SEAFOOD");
    expect(filtersToParams({ page: 1 }).toString()).toBe("");
  });

  test("reading it back gives the same filters", () => {
    const filters = { q: "sevan & salt", district: "NOR_NORK", price: 3, page: 2 } as const;

    expect(readFilters(filtersToParams(filters))).toEqual(filters);
  });
});

describe("isFiltered", () => {
  test("is true when a search or filter narrows the list, and the page doesn't count", () => {
    expect(isFiltered({ page: 4 })).toBe(false);
    expect(isFiltered({ q: "wine", page: 1 })).toBe(true);
    expect(isFiltered({ price: 1, page: 1 })).toBe(true);
  });
});

describe("labels", () => {
  test("a price shows as dram signs, and reads as words", () => {
    expect(priceSigns(3)).toBe("֏֏֏");
    expect(priceWords(1)).toBe("Inexpensive");
    expect(priceWords(4)).toBe("Very expensive");
  });

  test("cuisines read as one line", () => {
    expect(cuisineLine(["ARMENIAN", "MIDDLE_EASTERN"])).toBe("Armenian · Middle Eastern");
    expect(cuisineLine([])).toBe("");
  });
});

describe("toneFor", () => {
  test("gives a restaurant the same tone every time", () => {
    expect(toneFor("nurr")).toBe(toneFor("nurr"));
  });

  test("always gives one of the six tones", () => {
    const tones = ["kond-house", "lori-smokehouse", "nurr", "sevan-and-salt", "", "ա"].map(toneFor);

    for (const tone of tones) expect(tone).toMatch(/^bg-tone-[1-6]$/);
  });
});

describe("toneAt", () => {
  test("gives a row of tiles the tones in order, each different, then starts again", () => {
    expect([0, 1, 2, 3, 4, 5].map(toneAt)).toEqual([
      "bg-tone-1",
      "bg-tone-2",
      "bg-tone-3",
      "bg-tone-4",
      "bg-tone-5",
      "bg-tone-6",
    ]);
    expect(toneAt(6)).toBe("bg-tone-1");
  });
});
