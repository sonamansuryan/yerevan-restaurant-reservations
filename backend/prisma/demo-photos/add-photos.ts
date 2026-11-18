import type { PrismaClient } from "../../src/generated/prisma/client.ts";
import { isLocalPhoto, LOCAL_PHOTO_PREFIX } from "../../src/modules/photos/local-photos.ts";
import { DEMO_PHOTOS, demoPhotoRows } from "./photos.ts";

/** What adding the demo photos did, restaurant by restaurant. */
export interface DemoPhotosReport {
  /** Restaurants whose photos are now the demo photos. */
  added: string[];
  /** Restaurants left exactly as they were, because they have photos of their own. */
  ownPhotos: string[];
  /** Restaurants this database doesn't have, such as before the seed. */
  missing: string[];
}

/**
 * Gives each restaurant in photos.ts its demo photos, in one transaction. Running it again
 * changes nothing more: each photo is found by its publicId and brought up to date, and a demo
 * photo the list no longer has is removed. A restaurant with any photo of its own, such as an
 * owner's upload, is left exactly as it is, so the demo photos never mix with real ones. Nothing
 * else in the database is touched.
 */
export async function addDemoPhotos(db: PrismaClient): Promise<DemoPhotosReport> {
  const report: DemoPhotosReport = { added: [], ownPhotos: [], missing: [] };
  await db.$transaction(
    async (tx) => {
      for (const slug of Object.keys(DEMO_PHOTOS)) {
        const restaurant = await tx.restaurant.findUnique({
          where: { slug },
          select: { id: true, photos: { select: { publicId: true } } },
        });
        if (!restaurant) {
          report.missing.push(slug);
          continue;
        }
        if (restaurant.photos.some(({ publicId }) => !isLocalPhoto(publicId))) {
          report.ownPhotos.push(slug);
          continue;
        }

        const rows = demoPhotoRows(slug);
        await tx.restaurantPhoto.deleteMany({
          where: {
            restaurantId: restaurant.id,
            publicId: { startsWith: LOCAL_PHOTO_PREFIX, notIn: rows.map((row) => row.publicId) },
          },
        });
        for (const { publicId, ...photo } of rows) {
          await tx.restaurantPhoto.upsert({
            where: { publicId },
            update: photo,
            create: { ...photo, publicId, restaurantId: restaurant.id },
          });
        }
        report.added.push(slug);
      }
    },
    // About 40 statements, each waiting for a round trip: around 0.1 s each to the public demo's
    // database (PROJECT_PLAN.md 10.1), so more than the app's 5 seconds, as for the seed.
    { timeout: 120_000 },
  );
  return report;
}
