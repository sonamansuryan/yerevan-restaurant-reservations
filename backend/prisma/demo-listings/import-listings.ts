// Adds or updates the demo listings in listings.json (PROJECT_PLAN.md 9.7), and touches nothing
// else: each listing is found again by its OpenStreetMap id, or by its slug when it isn't there,
// so importing twice changes nothing.
// The database and the photo copier are passed in, so a database test can use yerevan_test and a
// stand-in for Cloudinary.
import { z } from "zod";

import type { PrismaClient } from "../../src/generated/prisma/client.ts";
import { Cuisine, District, TableZone } from "../../src/generated/prisma/enums.ts";
import { SEGHAN_TIME_ZONE } from "../../src/lib/time.ts";
import type { CopiedPhoto } from "../../src/integrations/cloudinary/remote-photos.ts";
import {
  extraOpenings,
  findOverlaps,
} from "../../src/modules/opening-hours/opening-hours.rules.ts";
import { ACTIVE_STATUSES } from "../../src/modules/reservations/reservations.rules.ts";
import { MAX_SEATS } from "../../src/modules/tables/tables.schemas.ts";
import {
  bookingsInTheWay,
  mayAffectBookings,
  refusalMessage,
} from "../../src/modules/tables/tables.rules.ts";
import type { TableChange } from "../../src/modules/tables/tables.rules.ts";
import { LISTINGS_OWNER, MAX_LISTINGS, MAX_PHOTOS, listingKey, photoPublicId } from "./rules.ts";

const opening = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    opensAt: z.number().int().min(0).max(1439),
    closesAt: z.number().int(),
  })
  .refine(({ opensAt, closesAt }) => closesAt > opensAt && closesAt - opensAt <= 1440);

const DETAIL_FIELDS = [
  "name",
  "address",
  "district",
  "cuisines",
  "openingHours",
  "phone",
  "website",
] as const;

// A photo from Commons, under a free license.
const commonsPhoto = z.object({
  title: z.string().startsWith("File:"),
  // Wikimedia's own file servers: the files, and the copies Commons makes of them.
  imageUrl: z.url().regex(/^https:\/\/(upload|thumb)\.wikimedia\.org\//),
  pageUrl: z.url().startsWith("https://commons.wikimedia.org/"),
  credit: z.string().min(1).max(300),
  freeLicense: z.literal(true),
});
// A photo from the restaurant's own site, known by its address. It isn't under a free license,
// so it's only for a private demo (rules.ts).
const ownPhoto = z
  .object({
    title: z.url().startsWith("https://"),
    imageUrl: z.url().startsWith("https://"),
    pageUrl: z.url().startsWith("https://"),
    credit: z.string().min(1).max(300),
    freeLicense: z.literal(false),
  })
  .refine(({ title, imageUrl }) => title === imageUrl);

const listing = z.object({
  osmRef: z
    .string()
    .regex(/^(node|way|relation)\/\d+$/)
    .nullable(),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  name: z.string().trim().min(1).max(120),
  // Empty when no source gives one: the page then shows no cuisine, rather than a guess.
  cuisines: z.array(z.enum(Cuisine)),
  district: z.enum(District),
  address: z.string().trim().min(1).max(200),
  phone: z.string().max(40).nullable(),
  website: z.url().nullable(),
  // The same limit as an owner's own.
  description: z.string().trim().min(1).max(1000).nullable(),
  // Empty when no source gives them: the page then says they aren't listed yet.
  openingHours: z
    .array(opening)
    // The same checks as an owner's week, in case the file was edited by hand.
    .refine((week) => findOverlaps(week).length === 0 && extraOpenings(week).length === 0),
  photos: z.array(z.union([commonsPhoto, ownPhoto])).max(MAX_PHOTOS),
  // Sample tables, with an owner's limits, so every listing can be booked to try Seghan out.
  tables: z
    .array(
      z
        .object({
          label: z.string().trim().min(1).max(20),
          capacity: z.number().int().min(1).max(MAX_SEATS),
          minCapacity: z.number().int().min(1),
          zone: z.enum(TableZone),
        })
        .refine(({ capacity, minCapacity }) => minCapacity <= capacity),
    )
    .min(1)
    .refine((tables) => new Set(tables.map(({ label }) => label)).size === tables.length),
  // For the reviewer only: the import doesn't use these.
  openingHoursText: z.string(),
  checkDate: z.string().nullable(),
  detailSources: z.partialRecord(z.enum(DETAIL_FIELDS), z.array(z.url()).min(1)),
  missing: z.array(z.string()),
});

/** listings.json, as collect.ts writes it. */
export const listingsFileSchema = z
  .object({ listings: z.array(listing).max(MAX_LISTINGS) })
  .refine(({ listings }) => new Set(listings.map(({ slug }) => slug)).size === listings.length, {
    message: "Two listings have the same slug.",
  })
  .refine(({ listings }) => new Set(listings.map(listingKey)).size === listings.length, {
    message: "A place is listed twice.",
  });

export type ListingsFile = z.infer<typeof listingsFileSchema>;

export type CopyPhoto = (sourceUrl: string, publicId: string) => Promise<CopiedPhoto>;

export interface ImportReport {
  added: string[];
  updated: string[];
  /** Listings no longer in the file: unpublished, never deleted. */
  unpublished: string[];
  photosCopied: number;
}

/**
 * Copies each listing's photos that aren't saved yet to Cloudinary, then writes every listing in
 * one transaction: the restaurant, with no price level, which no source gives; its whole week of
 * opening hours; its photos, credited; and its sample tables, so it can be booked to try Seghan
 * out. Listings that left the file are unpublished. Nothing that isn't a demo listing is ever read
 * or changed: a listing whose slug a restaurant on Seghan already has is refused before anything
 * is written.
 *
 * Tables follow an owner's rules, as their bookings are real ones in Seghan: a listing's tables are
 * locked before its restaurant, in id order, never deleted, only switched off, and the whole
 * import is refused if a change would leave an upcoming booking without its table or seats.
 */
export async function importListings(
  db: PrismaClient,
  { listings }: ListingsFile,
  copyPhoto: CopyPhoto,
  now: Date = new Date(),
): Promise<ImportReport> {
  // A listing is found again by its OpenStreetMap id, or by its slug when it isn't there.
  const osmRefs = listings.flatMap(({ osmRef }) => (osmRef ? [osmRef] : []));
  const ownSlugs = listings.filter(({ osmRef }) => !osmRef).map(({ slug }) => slug);
  // `not: null` keeps a listing without an id out of the first test: SQL's `NULL IN (…)` is
  // unknown rather than false, and `NOT` would leave it unknown, so it'd never be unpublished.
  const listed = {
    OR: [{ osmRef: { in: osmRefs, not: null } }, { osmRef: null, slug: { in: ownSlugs } }],
  };
  // A restaurant on Seghan with a listing's slug must never be touched, so nothing is written.
  const taken = await db.restaurant.findMany({
    where: { isDemoListing: false, slug: { in: listings.map(({ slug }) => slug) } },
    select: { slug: true },
  });
  if (taken.length > 0) {
    const slugs = taken.map(({ slug }) => slug).join(", ");
    throw new Error(`A restaurant on Seghan already has the address ${slugs}.`);
  }
  const existing = new Set(
    (await db.restaurant.findMany({ where: listed, select: { osmRef: true, slug: true } })).map(
      (row) => listingKey(row),
    ),
  );

  // Photos first, outside the transaction, because a transaction never waits on the network. A
  // photo already saved isn't copied again.
  const publicIds = listings.flatMap((item) =>
    item.photos.map(({ title }) => photoPublicId(listingKey(item), title)),
  );
  const saved = new Set(
    (
      await db.restaurantPhoto.findMany({
        where: { publicId: { in: publicIds } },
        select: { publicId: true },
      })
    ).map(({ publicId }) => publicId),
  );
  const copies = new Map<string, CopiedPhoto>();
  for (const item of listings) {
    for (const photo of item.photos) {
      const publicId = photoPublicId(listingKey(item), photo.title);
      if (!saved.has(publicId)) copies.set(publicId, await copyPhoto(photo.imageUrl, publicId));
    }
  }

  // Prisma's usual 5 seconds is plenty: even 99 listings with 4 photos each take under one.
  const unpublished = await db.$transaction(async (tx) => {
    const { id: ownerId } = await tx.user.upsert({
      where: { email: LISTINGS_OWNER.email },
      update: {},
      // No password and no Google account, so nobody can sign in as it.
      create: { email: LISTINGS_OWNER.email, name: LISTINGS_OWNER.name, role: "OWNER" },
    });

    for (const item of listings) {
      const fields = {
        slug: item.slug,
        name: item.name,
        description: item.description,
        cuisines: item.cuisines,
        district: item.district,
        address: item.address,
        phone: item.phone,
        website: item.website,
        priceLevel: null,
        isPublished: true,
        isDemoListing: true,
      };
      const where = item.osmRef ? { osmRef: item.osmRef } : { slug: item.slug };
      // An existing listing's tables are locked first, in id order, as every table change locks
      // them before the restaurant, so a booking in progress and the import take turns.
      const found = await tx.restaurant.findUnique({ where, select: { id: true } });
      if (found) {
        await tx.$queryRaw`
          SELECT "id" FROM "Table" WHERE "restaurantId" = ${found.id} ORDER BY "id" FOR UPDATE`;
      }
      // Seghan's admin may have hidden it, which stays as it is.
      const { id: restaurantId } = await tx.restaurant.upsert({
        where,
        update: fields,
        create: { ...fields, osmRef: item.osmRef, ownerId, timezone: SEGHAN_TIME_ZONE },
      });

      // Each sample table as the file says, matched by its label. One the file no longer names is
      // switched off, never deleted, so its bookings keep their history.
      const saved = await tx.table.findMany({
        where: { restaurantId },
        select: {
          id: true,
          label: true,
          capacity: true,
          minCapacity: true,
          zone: true,
          isActive: true,
        },
      });
      const changes = [
        ...item.tables.map((table) => ({
          table,
          row: saved.find(({ label }) => label === table.label),
        })),
        ...saved
          .filter(({ label }) => !item.tables.some((table) => table.label === label))
          .map((row) => ({ table: null, row })),
      ];
      for (const { table, row } of changes) {
        if (!row) {
          if (table) await tx.table.create({ data: { ...table, restaurantId } });
          continue;
        }
        const change: TableChange & { zone?: TableZone } = table
          ? {
              capacity: table.capacity,
              minCapacity: table.minCapacity,
              zone: table.zone,
              isActive: true,
            }
          : { isActive: false };
        const same =
          change.isActive === row.isActive &&
          (change.capacity ?? row.capacity) === row.capacity &&
          (change.minCapacity ?? row.minCapacity) === row.minCapacity &&
          (change.zone ?? row.zone) === row.zone;
        if (same) continue;
        if (mayAffectBookings(row, change)) {
          // Upcoming: still holding the table, and not over yet, as for an owner's change.
          const upcoming = await tx.reservation.findMany({
            where: { tableId: row.id, status: { in: ACTIVE_STATUSES }, endsAt: { gt: now } },
            select: { partySize: true },
          });
          const inTheWay = bookingsInTheWay(row, change, upcoming);
          if (inTheWay) {
            throw new Error(
              `${item.slug}, table ${row.label}: ${refusalMessage(inTheWay.refusal, inTheWay.bookings)}`,
            );
          }
        }
        await tx.table.update({ where: { id: row.id }, data: change });
      }

      // The whole week again, as when an owner saves theirs, which keeps any bookings made.
      await tx.openingHour.deleteMany({ where: { restaurantId } });
      await tx.openingHour.createMany({
        data: item.openingHours.map((hours) => ({ ...hours, restaurantId })),
      });

      const keep: string[] = [];
      for (const [index, photo] of item.photos.entries()) {
        const publicId = photoPublicId(listingKey(item), photo.title);
        keep.push(publicId);
        const order = {
          isCover: index === 0,
          sortOrder: index,
          credit: photo.credit,
          creditUrl: photo.pageUrl,
        };
        const copy = copies.get(publicId);
        if (copy) {
          await tx.restaurantPhoto.create({
            data: { ...order, restaurantId, publicId, url: copy.url },
          });
        } else {
          await tx.restaurantPhoto.update({ where: { publicId }, data: order });
        }
      }
      // A photo taken out of the file leaves the page. Its copy at Cloudinary stays.
      await tx.restaurantPhoto.deleteMany({ where: { restaurantId, publicId: { notIn: keep } } });
    }

    const gone = await tx.restaurant.findMany({
      where: { isDemoListing: true, isPublished: true, NOT: listed },
      select: { slug: true },
    });
    await tx.restaurant.updateMany({
      where: { isDemoListing: true, NOT: listed },
      data: { isPublished: false },
    });
    return gone.map(({ slug }) => slug);
  });

  return {
    added: listings.filter((item) => !existing.has(listingKey(item))).map(({ slug }) => slug),
    updated: listings.filter((item) => existing.has(listingKey(item))).map(({ slug }) => slug),
    unpublished,
    photosCopied: copies.size,
  };
}
