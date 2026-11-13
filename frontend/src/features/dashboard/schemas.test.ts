import { describe, expect, test } from "vitest";

import {
  BOOKING_LENGTHS,
  NEW_RESTAURANT,
  lengthWords,
  restaurantFields,
  restaurantFormSchema,
} from "@/features/dashboard/schemas";
import type { RestaurantFields } from "@/features/dashboard/schemas";
import { ownedLori } from "@/features/design/samples";

const filledIn: RestaurantFields = {
  ...NEW_RESTAURANT,
  name: "  Lori Smokehouse ",
  cuisines: ["ARMENIAN", "STEAKHOUSE"],
  district: "ARABKIR",
  address: "52 Komitas Avenue, Yerevan",
  priceLevel: "2",
};

/** The message for one field, or undefined if the field is fine. */
function messageFor(fields: RestaurantFields, field: keyof RestaurantFields): string | undefined {
  const result = restaurantFormSchema.safeParse(fields);
  return result.error?.issues.find((issue) => issue.path[0] === field)?.message;
}

describe("what's sent", () => {
  test("choices become numbers, names are trimmed, and empty details are none", () => {
    expect(restaurantFormSchema.parse(filledIn)).toEqual({
      name: "Lori Smokehouse",
      description: null,
      cuisines: ["ARMENIAN", "STEAKHOUSE"],
      district: "ARABKIR",
      address: "52 Komitas Avenue, Yerevan",
      phone: null,
      website: null,
      priceLevel: 2,
      slotIntervalMin: 30,
      reservationDurationMin: 120,
    });
  });

  test("a saved restaurant fills the form, and sends back the same details", () => {
    expect(restaurantFormSchema.parse(restaurantFields(ownedLori))).toEqual({
      name: ownedLori.name,
      description: ownedLori.description,
      cuisines: ownedLori.cuisines,
      district: ownedLori.district,
      address: ownedLori.address,
      phone: ownedLori.phone,
      website: ownedLori.website,
      priceLevel: ownedLori.priceLevel,
      slotIntervalMin: ownedLori.slotIntervalMin,
      reservationDurationMin: ownedLori.reservationDurationMin,
    });
  });

  test("with no price, as only a demo listing has (9.7), the price is still to choose", () => {
    expect(restaurantFields({ ...ownedLori, priceLevel: null }).priceLevel).toBe("");
  });
});

describe("the server's rules, in the server's words", () => {
  test("a name is needed", () => {
    expect(messageFor({ ...filledIn, name: "   " }, "name")).toBe("Enter the restaurant's name.");
  });

  test("one to three cuisines", () => {
    expect(messageFor({ ...filledIn, cuisines: [] }, "cuisines")).toBe(
      "Choose at least one cuisine.",
    );
    expect(
      messageFor(
        { ...filledIn, cuisines: ["ARMENIAN", "GEORGIAN", "ASIAN", "FUSION"] },
        "cuisines",
      ),
    ).toBe("Choose up to 3 cuisines.");
  });

  test("a district and a price must be chosen, not left on the prompt", () => {
    expect(messageFor({ ...filledIn, district: "" }, "district")).toBe(
      "Choose a district from the list.",
    );
    expect(messageFor({ ...filledIn, priceLevel: "" }, "priceLevel")).toBe(
      "Choose a price from ֏ to ֏֏֏֏.",
    );
  });

  test("a phone and a website have to look like one, when they're given", () => {
    expect(messageFor({ ...filledIn, phone: "call us" }, "phone")).toBe(
      "Enter a phone number, such as +374 10 123456.",
    );
    expect(messageFor({ ...filledIn, website: "lori.am" }, "website")).toBe(
      "Enter a website address, such as https://example.am.",
    );
    expect(messageFor({ ...filledIn, website: "javascript:alert(1)" }, "website")).toBe(
      "Enter a website address, such as https://example.am.",
    );
    expect(messageFor({ ...filledIn, website: "https://lori.am" }, "website")).toBeUndefined();
  });
});

describe("booking lengths", () => {
  test("30 minutes to 6 hours, in steps of 15 minutes", () => {
    expect(BOOKING_LENGTHS[0]).toBe(30);
    expect(BOOKING_LENGTHS.at(-1)).toBe(360);
    expect(BOOKING_LENGTHS.every((minutes) => minutes % 15 === 0)).toBe(true);
  });

  test("read in words", () => {
    expect(lengthWords(30)).toBe("30 minutes");
    expect(lengthWords(60)).toBe("1 hour");
    expect(lengthWords(90)).toBe("1 hour 30 minutes");
    expect(lengthWords(120)).toBe("2 hours");
    expect(lengthWords(135)).toBe("2 hours 15 minutes");
  });
});
