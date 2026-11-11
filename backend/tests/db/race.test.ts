// Database test 5 (PROJECT_PLAN.md §5.4), on real PostgreSQL: twenty guests book the same table
// for the same time at once, through the API, and exactly one gets it. Run with:
// npm run test:db -w backend
import request from "supertest";
import { afterAll, beforeEach, expect, test } from "vitest";

import { app } from "../../src/app.ts";
import { prisma } from "../../src/lib/prisma.ts";
import { addDays, localDate } from "../../src/lib/time.ts";
import { ACCESS_COOKIE } from "../../src/modules/auth/auth.cookies.ts";
import { signAccessToken } from "../../src/modules/auth/token.service.ts";
import { addRestaurant, emptyTestDatabase } from "./test-database.ts";
import type { TestRestaurant } from "./test-database.ts";

// A week from today in Yerevan: always more than an hour away, and within the 60 days.
const DATE = addDays(localDate(new Date(), "Asia/Yerevan"), 7);

let lori: TestRestaurant;

beforeEach(async () => {
  await emptyTestDatabase();
  lori = await addRestaurant();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// A race can play out differently each time, so it's run more than once.
test.each([1, 2, 3])(
  "database test 5, round %i: of 20 guests booking one table at once, exactly one gets it",
  async () => {
    const guests = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        prisma.user.create({
          data: { email: `guest${index}@example.com`, name: `Guest ${index}` },
        }),
      ),
    );
    // Signed first, so the twenty requests leave together.
    const tokens = await Promise.all(
      guests.map(({ id }) => signAccessToken({ id, role: "CUSTOMER" })),
    );

    const replies = await Promise.all(
      tokens.map((token) =>
        request(app)
          .post("/api/reservations")
          .set("Cookie", `${ACCESS_COOKIE}=${token}`)
          .send({ tableId: lori.t1, date: DATE, time: "19:00", partySize: 2 }),
      ),
    );

    const booked = replies.filter(({ status }) => status === 201);
    const refused = replies.filter(({ status }) => status === 409);
    expect(booked).toHaveLength(1);
    expect(refused).toHaveLength(19);
    expect(refused.every(({ body }) => body.error.code === "SLOT_TAKEN")).toBe(true);

    const saved = await prisma.reservation.findMany({ select: { id: true, status: true } });
    expect(saved).toEqual([{ id: booked[0]?.body.reservation.id, status: "PENDING" }]);
  },
);
