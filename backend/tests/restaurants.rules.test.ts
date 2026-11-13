// The rules for the restaurants guests see (src/modules/restaurants/restaurants.rules.ts): the home
// page's few, chosen by hand and filled up by name.
import { expect, test } from "vitest";

import {
  FEATURED_COUNT,
  FEATURED_SLUGS,
  featuredOrder,
} from "../src/modules/restaurants/restaurants.rules.ts";

const at = (...slugs: string[]) => slugs.map((slug) => ({ slug }));

test("the chosen ones in the chosen order, whatever order the database gives them in", () => {
  expect(FEATURED_SLUGS).toEqual(["gustav", "paul", "dolmama"]);
  expect(featuredOrder(at("dolmama", "gustav", "paul"), at("abovyan-12"))).toEqual(
    at("gustav", "paul", "dolmama"),
  );
});

test("one that can't be shown is left out, and the first others by name fill the row", () => {
  expect(featuredOrder(at("dolmama", "gustav"), at("abovyan-12", "charentsi-28"))).toEqual(
    at("gustav", "dolmama", "abovyan-12"),
  );
  expect(featuredOrder([], at("abovyan-12", "charentsi-28", "lavash", "sherep"))).toEqual(
    at("abovyan-12", "charentsi-28", "lavash"),
  );
});

test(`never more than ${FEATURED_COUNT}, never one twice, and fewer only when there aren't enough`, () => {
  expect(featuredOrder(at("gustav", "paul", "dolmama"), at("gustav", "lavash"))).toEqual(
    at("gustav", "paul", "dolmama"),
  );
  expect(featuredOrder(at("paul"), [])).toEqual(at("paul"));
});
