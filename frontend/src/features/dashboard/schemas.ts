import { z } from "zod";

import { CUISINE_LABELS, DISTRICT_LABELS } from "@/features/restaurants/labels";
import type { Cuisine, District, OwnerRestaurant } from "@/types/api";

// The server's rules and words (backend/src/modules/restaurants/restaurants.schemas.ts), so a
// problem shows under its field at once. The server still checks everything again.
const PHONE = "Enter a phone number, such as +374 10 123456.";
const WEBSITE = "Enter a website address, such as https://example.am.";
const PRICE = "Choose a price from ֏ to ֏֏֏֏.";
const SLOT_INTERVAL = "Choose start times every 15 or 30 minutes.";
const BOOKING_LENGTH =
  "Choose a booking length from 30 minutes to 6 hours, in steps of 15 minutes.";
const DISTRICT = "Choose a district from the list.";

export const CUISINES = Object.keys(CUISINE_LABELS) as [Cuisine, ...Cuisine[]];
export const DISTRICTS = Object.keys(DISTRICT_LABELS) as [District, ...District[]];

/** Booking lengths an owner can choose: 30 minutes to 6 hours, in steps of 15 minutes. */
export const BOOKING_LENGTHS = Array.from({ length: 23 }, (_, step) => 30 + step * 15);

// An optional detail left empty means "none", which also clears it.
const blankIsNull = (value: unknown): unknown =>
  typeof value === "string" ? value.trim() || null : value;

// A select or a box holds text, such as "2". These turn it into the number the server expects.
const chosenNumber = (message: string) =>
  z
    .string({ error: message })
    .min(1, message)
    .transform(Number)
    .pipe(z.number({ error: message }).int(message));

export const restaurantFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter the restaurant's name.")
    .max(80, "Use 80 characters or fewer."),
  description: z.preprocess(
    blankIsNull,
    z.string().max(1000, "Use 1,000 characters or fewer.").nullable(),
  ),
  // A group of boxes with one name holds a list of what's ticked.
  cuisines: z.preprocess(
    (value) => (Array.isArray(value) ? value : value ? [value] : []),
    z
      .array(z.enum(CUISINES, { error: "Choose a cuisine from the list." }))
      .min(1, "Choose at least one cuisine.")
      .max(3, "Choose up to 3 cuisines."),
  ),
  // The select starts on its prompt, "", which then isn't accepted as a district.
  district: z
    .enum(["", ...DISTRICTS] as ["", ...District[]], { error: DISTRICT })
    .pipe(z.enum(DISTRICTS, { error: DISTRICT })),
  address: z.string().trim().min(1, "Enter the address.").max(200, "Use 200 characters or fewer."),
  phone: z.preprocess(
    blankIsNull,
    z
      .string()
      .regex(/^\+?[\d ()-]{6,20}$/, PHONE)
      .nullable(),
  ),
  website: z.preprocess(
    blankIsNull,
    z
      .url({ protocol: /^https?$/, hostname: z.regexes.domain, error: WEBSITE })
      .max(200, "Use 200 characters or fewer.")
      .nullable(),
  ),
  priceLevel: chosenNumber(PRICE).pipe(z.number().min(1, PRICE).max(4, PRICE)),
  slotIntervalMin: chosenNumber(SLOT_INTERVAL).pipe(
    z.union([z.literal(15), z.literal(30)], { error: SLOT_INTERVAL }),
  ),
  reservationDurationMin: chosenNumber(BOOKING_LENGTH).pipe(
    z.number().min(30, BOOKING_LENGTH).max(360, BOOKING_LENGTH).multipleOf(15, BOOKING_LENGTH),
  ),
});

/** What the restaurant form's fields hold. Choices are text, as a select holds them. */
export type RestaurantFields = z.input<typeof restaurantFormSchema>;
/** What's sent, for a new restaurant or a change: numbers as numbers, and an empty detail as none. */
export type RestaurantRequest = z.output<typeof restaurantFormSchema>;

export const RESTAURANT_FIELDS = [
  "name",
  "description",
  "cuisines",
  "district",
  "address",
  "phone",
  "website",
  "priceLevel",
  "slotIntervalMin",
  "reservationDurationMin",
] as const satisfies readonly (keyof RestaurantFields)[];

/** A new restaurant's form: blank, with the booking settings at the database's own defaults. */
export const NEW_RESTAURANT: RestaurantFields = {
  name: "",
  description: "",
  cuisines: [],
  district: "",
  address: "",
  phone: "",
  website: "",
  priceLevel: "",
  slotIntervalMin: "30",
  reservationDurationMin: "120",
};

/** A saved restaurant, as its form shows it. */
export function restaurantFields(restaurant: OwnerRestaurant): RestaurantFields {
  return {
    name: restaurant.name,
    description: restaurant.description ?? "",
    cuisines: restaurant.cuisines,
    district: restaurant.district,
    address: restaurant.address,
    phone: restaurant.phone ?? "",
    website: restaurant.website ?? "",
    // Only a demo listing (9.7), which no owner manages, has none: then it's still to choose.
    priceLevel: restaurant.priceLevel === null ? "" : String(restaurant.priceLevel),
    slotIntervalMin: String(restaurant.slotIntervalMin),
    reservationDurationMin: String(restaurant.reservationDurationMin),
  };
}

/** A booking length in words: 120 is "2 hours", 90 is "1 hour 30 minutes". */
export function lengthWords(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourWords = hours === 0 ? "" : hours === 1 ? "1 hour" : `${hours} hours`;
  const minuteWords = rest === 0 ? "" : `${rest} minutes`;
  return [hourWords, minuteWords].filter(Boolean).join(" ");
}
