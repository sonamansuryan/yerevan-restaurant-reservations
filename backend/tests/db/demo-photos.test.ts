// Adding the fictional restaurants' demo photos, on real PostgreSQL: they become the restaurant's
// photos, with its room as the cover, in the list and on its page with their credits; adding them
// again changes nothing; and a restaurant with a photo of its own is left exactly as it is.
// Run with: npm run test:db -w backend
import request from "supertest";
import { afterAll, beforeEach, describe, expect, test } from "vitest";

import { addDemoPhotos } from "../../prisma/demo-photos/add-photos.ts";
import { demoPhotoRows } from "../../prisma/demo-photos/photos.ts";
import { app } from "../../src/app.ts";
import { prisma } from "../../src/lib/prisma.ts";
import { addRestaurant, emptyTestDatabase } from "./test-database.ts";

beforeEach(async () => {
  await emptyTestDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("demo photos", () => {
  test("Lori Smokehouse gets its photos, its room as the cover, credited on its page", async () => {
    await addRestaurant();

    const report = await addDemoPhotos(prisma);

    // The test database holds Lori Smokehouse only.
    expect(report.added).toEqual(["lori-smokehouse"]);
    expect(report.missing).toHaveLength(5);
    const list = await request(app).get("/api/restaurants");
    expect(list.body.data[0].coverPhotoUrl).toBe("/demo-photos/lori-smokehouse/1.webp");
    const page = await request(app).get("/api/restaurants/lori-smokehouse");
    expect(page.body.restaurant.photos).toEqual(
      demoPhotoRows("lori-smokehouse").map(({ url, isCover, credit, creditUrl }) => ({
        url,
        isCover,
        credit,
        creditUrl,
      })),
    );
  });

  test("adding them again changes nothing", async () => {
    await addRestaurant();
    await addDemoPhotos(prisma);
    const before = await prisma.restaurantPhoto.findMany({ orderBy: { sortOrder: "asc" } });

    await addDemoPhotos(prisma);

    expect(await prisma.restaurantPhoto.findMany({ orderBy: { sortOrder: "asc" } })).toEqual(
      before,
    );
  });

  test("a restaurant with a photo of its own is left exactly as it is", async () => {
    const { restaurantId } = await addRestaurant();
    const own = await prisma.restaurantPhoto.create({
      data: {
        restaurantId,
        publicId: `seghan/restaurants/${restaurantId}/1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d`,
        url: "https://res.cloudinary.com/test-cloud/image/upload/v1731240000/own",
        isCover: true,
      },
    });

    const report = await addDemoPhotos(prisma);

    expect(report.ownPhotos).toEqual(["lori-smokehouse"]);
    expect(await prisma.restaurantPhoto.findMany()).toEqual([own]);
  });
});
