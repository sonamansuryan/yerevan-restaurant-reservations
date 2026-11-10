import type { Cuisine, District } from "@/types/api";

// The words people see for the API's values. A Record needs every value, so a new cuisine or
// district in types/api.ts can't be shown without a label.
export const CUISINE_LABELS: Record<Cuisine, string> = {
  ARMENIAN: "Armenian",
  GEORGIAN: "Georgian",
  MIDDLE_EASTERN: "Middle Eastern",
  EUROPEAN: "European",
  ITALIAN: "Italian",
  ASIAN: "Asian",
  FUSION: "Fusion",
  SEAFOOD: "Seafood",
  STEAKHOUSE: "Steakhouse",
  VEGETARIAN: "Vegetarian",
};

// Yerevan's twelve districts, spelled as the city spells them in English.
export const DISTRICT_LABELS: Record<District, string> = {
  AJAPNYAK: "Ajapnyak",
  ARABKIR: "Arabkir",
  AVAN: "Avan",
  DAVTASHEN: "Davtashen",
  EREBUNI: "Erebuni",
  KANAKER_ZEYTUN: "Kanaker-Zeytun",
  KENTRON: "Kentron",
  MALATIA_SEBASTIA: "Malatia-Sebastia",
  NOR_NORK: "Nor Nork",
  NORK_MARASH: "Nork-Marash",
  NUBARASHEN: "Nubarashen",
  SHENGAVIT: "Shengavit",
};

export const PRICE_LEVELS = [1, 2, 3, 4] as const;

// What a screen reader says instead of "dram sign" up to four times.
const PRICE_WORDS = ["Inexpensive", "Moderate", "Expensive", "Very expensive"] as const;

/** ֏ to ֏֏֏֏, the way people see a price level. */
export function priceSigns(level: number): string {
  return "֏".repeat(level);
}

/** The same price level in words, for screen readers and select menus. */
export function priceWords(level: number): string {
  return PRICE_WORDS[level - 1] ?? "";
}

/** Armenian · Fusion, the cuisines as one line. */
export function cuisineLine(cuisines: Cuisine[]): string {
  return cuisines.map((cuisine) => CUISINE_LABELS[cuisine]).join(" · ");
}
