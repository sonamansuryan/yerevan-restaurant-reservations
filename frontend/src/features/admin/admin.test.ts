import { describe, expect, test } from "vitest";

import {
  adminListPath,
  adminRestaurantPath,
  filtersToParams,
  isFiltered,
  readReservationFilters,
  readRestaurantFilters,
  readUserFilters,
  visibilityWords,
} from "@/features/admin/admin";
import { adminRestaurants, hiddenTbilisi } from "@/features/design/samples";

const params = (query: string): URLSearchParams => new URLSearchParams(query);

describe("reading the filters from the address", () => {
  test("each list takes its own filters, the search trimmed", () => {
    expect(readRestaurantFilters(params("q=%20lori%20&show=hidden&page=2"))).toEqual({
      q: "lori",
      show: "hidden",
      page: 2,
    });
    expect(readReservationFilters(params("q=lilit&status=NO_SHOW&date=2026-11-14&page=3"))).toEqual(
      { q: "lilit", status: "NO_SHOW", date: "2026-11-14", page: 3 },
    );
    expect(readUserFilters(params("q=ani&role=OWNER"))).toEqual({
      q: "ani",
      role: "OWNER",
      page: 1,
    });
  });

  test("what the server would refuse is left out, so a hand-edited link shows everything", () => {
    expect(readRestaurantFilters(params("q=%20%20&show=deleted&page=0"))).toEqual({ page: 1 });
    expect(readReservationFilters(params("status=LATE&date=2026-02-30&page=1001"))).toEqual({
      page: 1,
    });
    expect(readReservationFilters(params("date=14-11-2026&page=1.5"))).toEqual({ page: 1 });
    expect(readUserFilters(params("role=CHEF&page=two"))).toEqual({ page: 1 });
  });

  test("a search is cut at 100 characters, as the API allows", () => {
    expect(readUserFilters(params(`q=${"a".repeat(120)}`)).q).toHaveLength(100);
  });
});

describe("writing them back", () => {
  test("only what's chosen, and page 1 is left out", () => {
    expect(filtersToParams({ q: "lori", show: undefined, page: 1 }).toString()).toBe("q=lori");
    expect(filtersToParams({ status: "PENDING", date: "2026-11-14", page: 2 }).toString()).toBe(
      "status=PENDING&date=2026-11-14&page=2",
    );
    expect(filtersToParams({ page: 1 }).toString()).toBe("");
  });

  test("the API's address takes the same query", () => {
    expect(adminListPath("users", { role: "ADMIN", page: 1 })).toBe("/api/admin/users?role=ADMIN");
    expect(adminListPath("restaurants", { page: 1 })).toBe("/api/admin/restaurants");
    expect(adminRestaurantPath("a b")).toBe("/api/admin/restaurants/a%20b");
  });

  test("a list is filtered when anything but the page is chosen", () => {
    expect(isFiltered({ page: 4 })).toBe(false);
    expect(isFiltered({ page: 1, show: "draft" })).toBe(true);
    expect(isFiltered({ page: 1, q: undefined })).toBe(false);
  });
});

describe("what a change did, in words", () => {
  const lori = adminRestaurants[1]!;

  test("hidden, or shown again to guests, or back to the owner's draft", () => {
    expect(visibilityWords(hiddenTbilisi)).toBe(
      "Tbilisi Courtyard is hidden. Guests can’t find or book it until you show it again.",
    );
    expect(visibilityWords(lori)).toBe(
      "Lori Smokehouse is shown again. Guests can find it and book a table.",
    );
    expect(visibilityWords({ ...lori, isPublished: false })).toBe(
      "Lori Smokehouse is no longer hidden. It’s a draft, so guests will see it once its owner publishes it.",
    );
  });
});
