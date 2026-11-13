// The rules for an owner's restaurant that need no database (src/modules/restaurants/owner.rules.ts):
// its address on Seghan, and whether it's ready for guests.
import { describe, expect, test } from "vitest";

import {
  SLUG_MAX_LENGTH,
  freeSlug,
  notReadyMessage,
  publishBlockers,
  slugFromName,
} from "../src/modules/restaurants/owner.rules.ts";

describe("slugFromName", () => {
  test("lowercase words joined by single dashes, with & as 'and'", () => {
    expect(slugFromName("Sevan & Salt")).toBe("sevan-and-salt");
    expect(slugFromName("  Tbilisi   Courtyard!  ")).toBe("tbilisi-courtyard");
    expect(slugFromName("Kond House, est. 1998")).toBe("kond-house-est-1998");
  });

  test("Armenian names, in the Latin letters they're usually written in", () => {
    expect(slugFromName("Սեղան")).toBe("seghan");
    expect(slugFromName("Ծիրան")).toBe("tsiran");
    expect(slugFromName("Թումանյան Շաուրմա")).toBe("tumanyan-shaurma");
  });

  test("at the start of a word ե is 'ye', ո is 'vo' and և is 'yev', but ու is always 'u'", () => {
    expect(slugFromName("Երևան")).toBe("yerevan");
    expect(slugFromName("Ոսկի")).toBe("voski");
    expect(slugFromName("Ուրարտու")).toBe("urartu");
    expect(slugFromName("Սևան")).toBe("sevan");
  });

  test("Armenian and Latin together, as the demo restaurants could be written", () => {
    expect(slugFromName("Լոռի Smokehouse")).toBe("lori-smokehouse");
    expect(slugFromName("Ծիրան Wine Room")).toBe("tsiran-wine-room");
  });

  test("accents are dropped, and an apostrophe stays inside its word", () => {
    expect(slugFromName("Café Nurr")).toBe("cafe-nurr");
    expect(slugFromName("Ani’s Place")).toBe("anis-place");
    expect(slugFromName("Ani's Place")).toBe("anis-place");
  });

  test("a name in another alphabet, or only symbols, still gets an address", () => {
    expect(slugFromName("Пицца Хаус")).toBe("restaurant");
    expect(slugFromName("☕ ✨")).toBe("restaurant");
  });

  test("a long name stops at the last whole word that fits", () => {
    const slug = slugFromName(
      "The Very Long Name Of A Restaurant That Keeps Going Well Past Sixty Characters",
    );

    expect(slug).toBe("the-very-long-name-of-a-restaurant-that-keeps-going-well");
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
  });

  test("a single word longer than the limit is cut, not lost", () => {
    expect(slugFromName("x".repeat(80))).toBe("x".repeat(SLUG_MAX_LENGTH));
  });
});

describe("freeSlug", () => {
  test("the name's own address, when it's free", () => {
    expect(freeSlug("kond", [])).toBe("kond");
    // kond-house starts with "kond", but it's another restaurant's address, not a taken "kond".
    expect(freeSlug("kond", ["kond-house"])).toBe("kond");
  });

  test("an address the app's own routes use is never a restaurant's", () => {
    // /api/restaurants/featured is the home page's few, so a restaurant called Featured gets -2.
    expect(freeSlug("featured", [])).toBe("featured-2");
    expect(freeSlug("featured-house", [])).toBe("featured-house");
  });

  test("the next number after the highest one taken", () => {
    expect(freeSlug("kond", ["kond"])).toBe("kond-2");
    expect(freeSlug("kond", ["kond", "kond-2", "kond-house"])).toBe("kond-3");
    expect(freeSlug("kond", ["kond", "kond-7", "kond-2"])).toBe("kond-8");
  });
});

describe("publishing", () => {
  test("needs at least one active table and opening hours", () => {
    expect(publishBlockers({ activeTables: 0, openingHours: 0 })).toEqual([
      "TABLE",
      "OPENING_HOURS",
    ]);
    expect(publishBlockers({ activeTables: 0, openingHours: 7 })).toEqual(["TABLE"]);
    expect(publishBlockers({ activeTables: 4, openingHours: 0 })).toEqual(["OPENING_HOURS"]);
    expect(publishBlockers({ activeTables: 1, openingHours: 1 })).toEqual([]);
  });

  test("the message names exactly what's missing", () => {
    expect(notReadyMessage(["TABLE", "OPENING_HOURS"])).toBe(
      "Add at least one table and your opening hours before you publish.",
    );
    expect(notReadyMessage(["TABLE"])).toBe("Add at least one table before you publish.");
    expect(notReadyMessage(["OPENING_HOURS"])).toBe("Add your opening hours before you publish.");
  });
});
